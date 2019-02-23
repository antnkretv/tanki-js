// 10.12.2016

// TODO: Появляющиеся объекты для суперсилы
// TODO: Боты должны пробивать стены
// TODO: Красивый интерфейс
// TODO: Портировть на телефон

var trace = m => console.log(m);

var Game = {
    arenaObj: {},
    config: {},
    playersCount: 0, //  Количество игроков
    botCount: 0, //  Количество ботов
    started: false, // Запущена ли игра

    rating: {
        score: {}
    },

    getPositionFromUnit: (unitX, unitY) => {
        return {
            pxX: unitX * Game.config.arenaSizeUnit,
            pxY: unitY * Game.config.arenaSizeUnit
        }
    },

    getPxFromUnit: (unit) => unit * Game.config.arenaSizeUnit,

    initialize: () => {
        (function arenaBuilding() {
            Game.arenaObj = document.getElementsByClassName('arena-block')[0];
            Game.arenaObj.style.width = Game.config.arenaWidthUnit * Game.config.arenaSizeUnit
                + Game.config.unit;
            Game.arenaObj.style.height = Game.config.arenaHeightUnit * Game.config.arenaSizeUnit
                + Game.config.unit;
        })();

        (function eventVolumeSlider() {
            var slider = document.getElementsByClassName('volume-slider')[0];
            var max = document.getElementsByClassName('volume')[0].offsetWidth;
            slider.style.left = Game.config.volume * max / 100 - slider.offsetWidth / 2 + 'px';

            slider.onmousedown = function (e) {
                document.onmousemove = function (e) {
                    var val = e.pageX - slider.offsetWidth;

                    if (val > 0 & val < max - slider.offsetWidth) {
                        slider.style.left = val + 'px';
                        Game.config.volume = val / max * 100;
                    }
                }

                document.onmouseup = function () {
                    document.onmousemove = null;
                    document.onmouseup = null;
                };

                slider.ondragstart = function () { return false; };
            }
        })();

        Game.started = true;
    },

    statusUpdate: () => {
        var score = document.getElementsByClassName('score')[0];
        var tbody = score.getElementsByTagName('tbody')[0];
        var trs = tbody.getElementsByTagName('tr');

        if (trs.length == 0) {

            for (let i in Game.Tank.tanks.arr) {
                let t = Game.Tank.tanks.arr[i];

                let tr = document.createElement('tr');
                tr.id = t.type;

                let tdImg = document.createElement('td');
                tdImg.className = 'tank-img ' + t.type;

                let tdLife = document.createElement('td');
                tdLife.className = 'tank-life';

                let tdQuantity = document.createElement('td');
                tdQuantity.className = 'tank-bullet-quantity';

                let tdScore = document.createElement('td');
                tdScore.className = 'tank-score';

                tr.appendChild(tdImg);

                tr.appendChild(tdLife);
                tr.appendChild(tdQuantity);
                tr.appendChild(tdScore);

                tbody.appendChild(tr);
            }

            score.appendChild(tbody)
        }

        for (let i = 0; i < Game.Tank.tanks.arr.length; i++) {
            let t = Game.Tank.tanks.arr[i];

            let tr = document.getElementById(t.type);
            tr.getElementsByClassName('tank-life')[0].innerText = t.life;
            tr.getElementsByClassName('tank-bullet-quantity')[0].innerText = t.bulletQuantity;
            tr.getElementsByClassName('tank-score')[0].innerText = t.killTanks;

            Game.rating.score[t.type] = t.killTanks;
        }

        // Проверяем сколько осталось игроков
        let playersRemaining = 0;
        let botRemaining = 0;
        for (let i = 0; i < Game.Tank.tanks.arr.length; i++) {
            if (Game.Tank.tanks.arr[i].isBot)
                botRemaining++;                
            else
                playersRemaining++;
        }
        if (playersRemaining != Game.playersCount
            || botRemaining == 0) {

            Game.final();
        }
    },

    final: () => {
        Game.playersCount = 0;
        Game.Let.lets.removeAll();
        Game.Tank.tanks.removeAll();
        newGame();
    },
}

Game.Tank = function (conf) {    
    this.life = 100; // Жизни   
    this.bulletQuantity = conf.bulletQuantity;
    this.angle = conf.angle;
    this.x = conf.x;
    this.y = conf.y;
    this.type = conf.type;
    this.killTanks = Game.rating.score[this.type] || 0; // Очки
    this.name = conf.name;
    this.impactLife = conf.impactLife;
    this.isBot = false;
    this.size = 3;
    this.bot_enemyAngle = {}; // В каких направлениях вражеские танки    

    var shotInterval = conf.shotInterval;
    var speedTank = conf.speed;
    var speedBullet = conf.speedBullet;
    var controls = conf.controls;
    var bot_isLetOnWay = false; // уперся ли бот
    var timerMoveId;
    var timerBotId;
    var flagShot = true; // разрешен ли выстрел
    var bullets = [];
    var moveMode = 1; // передвигается на 1 unit    
    var obj = (() => {
        if (this.x == undefined || this.y == undefined) {
            var pos = generateStartPos(this.size);
            this.x = pos.x;
            this.y = pos.y;
        }

        var tankWrapper = document.createElement('div');
        tankWrapper.style.top = Game.getPxFromUnit(this.y) + Game.config.unit;
        tankWrapper.style.left = Game.getPxFromUnit(this.x) + Game.config.unit;
        tankWrapper.style.width = Game.getPxFromUnit(this.size) + Game.config.unit;
        tankWrapper.style.height = Game.getPxFromUnit(this.size) + Game.config.unit;
        tankWrapper.className = "tank ";

        let t = Game.Tank.types;
        switch (this.type) {
            case t.player1:
                Game.playersCount++;
                tankWrapper.className += 'tank-player1';
                break;
            case t.player2:
                Game.playersCount++;
                tankWrapper.className += 'tank-player2';
                break;
            case t.bot1:
                this.isBot = true;
                Game.botCount++;
                tankWrapper.className += 'tank-bot1';
                break;
            case t.bot2:
                this.isBot = true;
                Game.botCount++;
                tankWrapper.className += 'tank-bot2';
                break;
            case t.bot3:
                this.isBot = true;
                Game.botCount++;
                tankWrapper.className += 'tank-bot3';
                break;
            default:
        }

        Game.arenaObj.appendChild(tankWrapper);
        return tankWrapper;
    })();
    var keyState = {};
    var angles = Game.Tank.rotateAngles;
    var currentDirection;

    var keydown = e => keyState[e instanceof KeyboardEvent ? e.keyCode || e.which : e] = true;
    var keyup = e => keyState[e instanceof KeyboardEvent ? e.keyCode || e.which : e] = false;

    if (this.isBot) {
        currentDirection = generateDirection();
        keydown(currentDirection);

        timerBotId = setInterval(() => {

            shot.call(this, true);
            keyState[controls.l] = keyState[controls.t] = keyState[controls.r] = keyState[controls.b] = false;
            keydown(controls.s);

            if (this.bot_enemyAngle[angles.left]) {
                rotate.call(this, angles.left);
                currentDirection = controls.l;
            }
            else if (this.bot_enemyAngle[angles.top]) {
                rotate.call(this, angles.top);
                currentDirection = controls.t;
            }
            else if (this.bot_enemyAngle[angles.right]) {
                rotate.call(this, angles.right);
                currentDirection = controls.r;
            }
            else if (this.bot_enemyAngle[angles.bottom]) {
                rotate.call(this, angles.bottom);
                currentDirection = controls.b;
            }
            else {                
                keyup(controls.s); 
                keydown(currentDirection);
            }

            if (bot_isLetOnWay) {
                currentDirection = generateDirection();
                keydown(currentDirection);
                bot_isLetOnWay = false;
            }
        }, speedTank* 1.5);

        function generateDirection() {
            let dir = Math.floor(Math.random() * 4);            
            return dir == currentDirection ? generateDirection() : dir;
        }
    }
    else {
        document.addEventListener('keydown', keydown);
        document.addEventListener('keyup', keyup);
    }

    timerMoveId = setInterval(() => {
        if (keyState[controls.s] & flagShot) {
            shot.call(this);
            flagShot = false;
        }

        if (keyState[controls.l]) {
            if (this.angle != angles.left) {
                rotate.call(this, angles.left);
                return;
            }
            move.call(this, (x, y) => { return { x: x - moveMode, y: y } });
        }
        else if (keyState[controls.t]) {
            if (this.angle != angles.top) {
                rotate.call(this, angles.top);
                return;
            }
            move.call(this, (x, y) => { return { x: x, y: y - moveMode } });
        }
        else if (keyState[controls.r]) {
            if (this.angle != angles.right) {
                rotate.call(this, angles.right);
                return;
            }
            move.call(this, (x, y) => { return { x: x + moveMode, y: y } });
        }
        else if (keyState[controls.b]) {
            if (this.angle != angles.bottom) {
                rotate.call(this, angles.bottom);
                return;
            }
            move.call(this, (x, y) => { return { x: x, y: y + moveMode } });
        }
    }, speedTank);

    function rotate(a) {
        this.angle = a;
        obj.style.transform = 'rotate(' + this.angle + 'deg)';
    }

    function move(moveFunc) {
        var newPos = moveFunc(this.x, this.y);

        if (newPos.x < 0 | newPos.x + this.size > Game.config.arenaWidthUnit
            | newPos.y < 0 | newPos.y + this.size > Game.config.arenaHeightUnit
            | Game.Let.lets.get(newPos.x, newPos.y, this.size) != undefined
            | Game.Tank.tanks.get(newPos.x, newPos.y, this.size, this) != undefined
        ) {
            bot_isLetOnWay = true;
            return;
        }

        this.x = newPos.x;
        this.y = newPos.y;

        obj.style.top = Game.getPxFromUnit(this.y) + Game.config.unit;
        obj.style.left = Game.getPxFromUnit(this.x) + Game.config.unit;
    }

    function shot(isScout = false) {
        if (isScout) {
            Game.Bullet.bullets.add(new Game.Bullet({
                tank: this,
                speed: speedBullet,
                isScout: true,
                angle: Game.Tank.rotateAngles.left
            }));
            Game.Bullet.bullets.add(new Game.Bullet({
                tank: this,
                speed: speedBullet,
                isScout: true,
                angle: Game.Tank.rotateAngles.top
            }));
            Game.Bullet.bullets.add(new Game.Bullet({
                tank: this,
                speed: speedBullet,
                isScout: true,
                angle: Game.Tank.rotateAngles.right
            }));
            Game.Bullet.bullets.add(new Game.Bullet({
                tank: this,
                speed: speedBullet,
                isScout: true,
                angle: Game.Tank.rotateAngles.bottom
            }));
        }
        else if (this.bulletQuantity > 0) {
            this.bulletQuantity--;
            Game.statusUpdate();
            Game.Player.shot();
            Game.Bullet.bullets.add(new Game.Bullet({
                tank: this,
                speed: speedBullet,
            }));
            flagShot = false;
            setTimeout(() => flagShot = true, shotInterval);
        }
    }

    this.crash = function () {
        if (!this.isBot) {
            document.removeEventListener('keydown', keydown);
            document.removeEventListener('keyup', keyup);
        }

        clearInterval(timerMoveId);
        clearInterval(timerBotId);
        obj.remove();
        delete obj;
        delete this;
    }
}

Game.Tank.tanks = {
    arr: [],

    add: function (t) {
        if (t instanceof Game.Tank) {
            this.arr.push(t);
        }
        else {
            trace(t + 'Не является обектом "Game.Bullet"');
            return false;
        }
    },

    get: function (x, y, s, context) { // входит ли объект в область танка              
        return getObjOfArr(this.arr, x, y, s, context);
    },

    find: function (name) {
        for (var i in this.arr) {
            let tank = this.arr[i];
            if (tank.name == name)
                return tank;
        }
    },

    remove: function (t) {
        if (t instanceof Game.Tank == false) {
            trace(t + 'Не является обектом "Game.Bullet"');
            return false;
        }
        this.arr.splice(this.arr.indexOf(t), 1);
        t.crash();
        return true;
    },

    removeAll: function () {
        for (var i = 0; i < this.arr.length; i++) {
            this.arr[i].crash();
        }
        this.arr = [];
    },
}

Game.Tank.rotateAngles = {
    bottom: 0,
    left: 90,
    top: 180,
    right: 270
}

Game.Tank.types = {
    player1: 'tank-player1',
    player2: 'tank-player2',
    bot1: 'tank-bot1',
    bot2: 'tank-bot2',
    bot3: 'tank-bot3'
}

Game.Tank.configurations = {
    player1: {
        bulletQuantity: 50, // количество патрон
        angle: Game.Tank.rotateAngles.bottom, // Начальное направление
        x: undefined, // начальное положение (рендом)
        y: undefined,
        type: Game.Tank.types.player1, // тип танка
        name: 'player1', // имя танка    
        shotInterval: 200, // период выстрелов
        speed: 70, // скорость танка
        speedBullet: 10, // скорость перемещения патрона
        controls: { l: 65, t: 87, r: 68, b: 83, s: 32 }, // кнопки управления
        impactLife: 50, // мощность выстрела

    },
    player2: {
        bulletQuantity: 50,
        angle: Game.Tank.rotateAngles.bottom,
        x: undefined,
        y: undefined,
        type: Game.Tank.types.player2,
        name: 'player2',
        shotInterval: 200,
        speed: 70,
        speedBullet: 10,
        controls: { l: 37, t: 38, r: 39, b: 40, s: 45 },
        impactLife: 10,
    },
    bot1: {
        bulletQuantity: 50,
        angle: Game.Tank.rotateAngles.bottom,
    //    x: 57,
    //    y: 0,
        type: Game.Tank.types.bot1,
        name: 'bot1',
        shotInterval: 200,
        speed: 70,
        speedBullet: 10,
        controls: { l: 0, t: 1, r: 2, b: 3, s: 4, },
        impactLife: 10,
    },
    bot2: {
        bulletQuantity: 50,
        angle: Game.Tank.rotateAngles.bottom,
        x: undefined,
        y: undefined,
        type: Game.Tank.types.bot2,
        name: 'bot2',
        shotInterval: 200,
        speed: 70,
        speedBullet: 10,
        controls: { l: 0, t: 1, r: 2, b: 3, s: 4, },
        impactLife: 10,
    },
    bot3: {
        bulletQuantity: 50,
        angle: Game.Tank.rotateAngles.bottom,
        x: undefined,
        y: undefined,
        type: Game.Tank.types.bot3,
        name: 'bot3',
        shotInterval: 200,
        speed: 70,
        speedBullet: 10,
        controls: { l: 0, t: 1, r: 2, b: 3, s: 4, },
        impactLife: 10,
    }
}

Game.Bullet = function (conf) {
    this.tank = conf.tank;
    this.y = this.tank.y + 1;
    this.x = this.tank.x + 1;
    this.isScout = conf.isScout || false; // является ли патрон разведочным        
    
    var speedBullet = this.isScout ? 1 : conf.speed;
    var angle = conf.angle == undefined ? this.tank.angle : conf.angle;
    var size = 1;
    var stepBullet = 1; // Шаг движения патрона
    var stepTop = stepBullet;
    var stepLeft = 0;
    var timerId = setInterval(() => move.call(this), speedBullet);

    switch (angle) {
        case 0:
            this.y = this.tank.y + 3;
            this.x = this.tank.x + 1;

            stepTop = stepBullet;
            break;
        case 90:
            this.y = this.tank.y + 1;
            this.x = this.tank.x - 1;

            stepTop = 0;
            stepLeft = -stepBullet;
            break;
        case 180:
            this.y = this.tank.y - 1;
            this.x = this.tank.x + 1;

            stepTop = -stepBullet;
            break;
        case 270:
            this.y = this.tank.y + 1;
            this.x = this.tank.x + 3;

            stepTop = 0;
            stepLeft = stepBullet;
            break;
        default:
    }
    var bullet = (() => {
        var bullet = document.createElement('div');
        bullet.className = this.isScout ? 'bullet-scout' : "bullet";
        bullet.style.width = Game.getPxFromUnit(size) + Game.config.unit;
        bullet.style.height = Game.getPxFromUnit(size) + Game.config.unit;
        bullet.style.top = Game.getPxFromUnit(this.y) + Game.config.unit;
        bullet.style.left = Game.getPxFromUnit(this.x) + Game.config.unit;

        bullet.style.transform = 'rotate(' + angle + 'deg)';
        bullet.style.zIndex = 0;
        Game.arenaObj.appendChild(bullet);
        return bullet;
    })();

    this.crash = function () {
        clearInterval(timerId);
        bullet.remove();
        delete bullet;
        delete this;
    }

    function move() {
        if (this.y + stepTop < 0
            || this.y + stepTop + size > Game.config.arenaHeightUnit
            || this.x + stepLeft < 0
            || this.x + stepLeft + size > Game.config.arenaWidthUnit) {
            Game.Bullet.bullets.remove(this);
        }

        this.x += stepLeft;
        this.y += stepTop;
        bullet.style.top = Game.getPxFromUnit(this.y) + Game.config.unit;
        bullet.style.left = Game.getPxFromUnit(this.x) + Game.config.unit;

        var t = Game.Tank.tanks.get(this.x, this.y, size, this);
        var l = Game.Let.lets.get(this.x, this.y, size, this);

        if (!this.isScout) {
            if (t != undefined) {
                Game.Player.detonation();

                t.life -= this.tank.impactLife;
                Game.Bullet.bullets.remove(this);
                if (t.life <= 0) {
                    this.tank.killTanks += 1;
                    Game.statusUpdate();
                    Game.Tank.tanks.remove(t);
                }
                Game.statusUpdate();

                return;
            }

            if (l != undefined) {
                var type = Game.Let.types;
                switch (l.type) {
                    case type.brick:

                        Game.Let.lets.remove(l);
                        Game.Bullet.bullets.remove(this);
                        break;
                    case type.stone:
                        Game.Player.shotStone();
                        Game.Bullet.bullets.remove(this);
                        break;
                    case type.grass:
                        break;
                    case type.water:
                        Game.Player.shotWater();
                        Game.Bullet.bullets.remove(this);
                        break;
                }
                return;
            }

            var b = Game.Bullet.bullets.get(this.x, this.y, size, this);
            if (b != undefined
                && b.tank != this.tank
                && !b.isScout) {
                
                Game.Bullet.bullets.remove(b);
                Game.Bullet.bullets.remove(this);
                return;
            }
        }
        else { // Если разведовательный
            if (l != undefined) {
                Game.Bullet.bullets.remove(this);
            }
            else if (t != undefined
                && !t.isBot) {                
                Game.Bullet.bullets.remove(this);
                this.tank.bot_enemyAngle[angle] = true;                
            }
            else
                this.tank.bot_enemyAngle[angle] = false;
        }
    }
}

Game.Bullet.bullets = {
    arr: [],

    add: function (b) {
        if (b instanceof Game.Bullet) {
            this.arr.push(b);
            return true;
        }
        trace(b + 'Не является обектом "Game.Bullet"');
        return false;
    },

    get: function (x, y, s, c) { // входит ли объект в область патрона        
        return getObjOfArr(this.arr, x, y, s, c);
    },

    remove: function (b) {
        if (b instanceof Game.Bullet == false) {
            trace(b + 'Не является обектом "Game.Bullet"');
            return false;
        }
        this.arr.splice(this.arr.indexOf(b), 1);
        b.crash();

        return true;
    },
}

Game.Let = function (conf) {
    this.x = conf.x || 0;
    this.y = conf.y || 0;
    this.size = conf.size || 2;
    this.type = conf.type || Game.Let.types.brick;

    var letWrapper = (() => {
        var letWrapper = document.createElement('div');
        letWrapper.style.top = Game.getPxFromUnit(this.y) + Game.config.unit;
        letWrapper.style.left = Game.getPxFromUnit(this.x) + Game.config.unit;
        letWrapper.style.width = Game.getPxFromUnit(this.size) + Game.config.unit;
        letWrapper.style.height = Game.getPxFromUnit(this.size) + Game.config.unit;
        letWrapper.className = "let ";

        var t = Game.Let.types;
        switch (this.type) {
            case t.brick:
                letWrapper.className += 'let-brick';
                break;
            case t.stone:
                letWrapper.className += 'let-stone';
                break;
            case t.grass:
                letWrapper.className += 'let-grass';
                break;
            case t.water:
                letWrapper.className += 'let-water';
                break;
        }

        Game.arenaObj.appendChild(letWrapper);
        return letWrapper;
    })();

    this.crash = function () {
        letWrapper.remove();
        delete letWrapper;
        delete this;
    }
}

Game.Let.lets = {
    arr: [],

    add: function (lets) {
        for (var i in lets) {
            var l = lets[i];

            if (l instanceof Game.Let) {
                this.arr.push(l);
            } else {
                trace(l + 'Не является обектом "Game.Bullet"');
                return false;
            }
        }
    },

    addRandom: function (count) {
        var LetsizeUnit = 3;
        var lets = [];

        for (let i = 0; i < count; i++) {
            let pos = generateStartPos(LetsizeUnit);

            Game.Let.lets.arr.push(new Game.Let({
                x: pos.x,
                y: pos.y,
                size: LetsizeUnit,
                type: Math.floor(Math.random() * 3)
            }))
        }
    },

    remove: function (l) {
        if (l instanceof Game.Let == false) {
            trace(l + 'Не является обектом "Game.Bullet"');
            return false;
        }
        this.arr.splice(this.arr.indexOf(l), 1);
        l.crash();
        return true;
    },

    removeAll: function () {
        for (var i = 0; i < this.arr.length; i++) {
            this.arr[i].crash();
        }
        this.arr = [];
    },

    get: function (x, y, s, c) { // входит ли объект в область препятствия        
        return getObjOfArr(this.arr, x, y, s, c);
    },
}

Game.Let.types = {
    brick: 0,
    stone: 1,
    grass: 2,
    water: 3
}

Game.Player = {    
    play: function (p) {
        if (document.getElementsByClassName('soundCheck')[0].checked) {
            let player = new Audio(p);            
            player.volume = (Game.config.volume || 100) / 100;
            player.play();
        }
    },
    shot: function () { this.play('sound/shot.wav') },
    shotStone: function () { this.play('sound/shot-stone.wav') },
    shotWater: function () { this.play('sound/shot-water.mp3') },
    start: function () { this.play('sound/start.wav') },
    detonation: function () { this.play('sound/detonation.wav') },
}

function generateStartPos(size) {
    var x, y;
    var aw = [], ah = [];

    for (let i = 0; i < Game.config.arenaWidthUnit / size-1; i++) {
        aw[i] = i * size;
    }
    for (let i = 0; i < Game.config.arenaHeightUnit / size-1; i++) {
        ah[i] = i * size;
    }

    while (true) {
        x = aw[Math.floor(Math.random() * aw.length)];
        y = ah[Math.floor(Math.random() * ah.length)];
        let l = Game.Let.lets.get(x, y, size, undefined);
        let t = Game.Tank.tanks.get(x, y, size, undefined);
        if (l == undefined
            && t == undefined) {
            return { x: x, y: y }
        }
    }
}

function getObjOfArr(arr, x, y, s, self) {
    for (let i = arr.length - 1; i >= 0; i--) {
        let l = arr[i];
        if (l === self) continue;

        if (
            ((l.y >= y & l.y < y + s) | (l.y <= y & l.y + l.size >= y + s) | (l.y + l.size > y & l.y + l.size <= y + s))
            & ((l.x >= x & l.x < x + s) | (l.x <= x & l.x + l.size >= x + s) | (l.x + l.size > x & l.x + l.size <= x + s))
        ) {
            if (l instanceof Game.Let
                && (l.type == Game.Let.types.grass
                    || l.type == Game.Let.types.grass)) {
                continue;
            }
            return l;
        }
    }
}

//////////////////////////  GAME  //////////////////////////

Game.config = {
    arenaWidthUnit: 60,
    arenaHeightUnit: 25,
    arenaSizeUnit: 15,
    unit: "px",
    volume: 10,
}

Game.config.arenaWidthUnit = window.innerWidth / Game.config.arenaSizeUnit-1;
Game.config.arenaHeightUnit = window.innerHeight / Game.config.arenaSizeUnit-1;

Game.initialize();

newGame();

function newGame() {
    Game.Let.lets.addRandom(250);

    Game.Tank.tanks.add(new Game.Tank(Game.Tank.configurations.player1));
    Game.Tank.tanks.add(new Game.Tank(Game.Tank.configurations.player2));

    Game.Tank.tanks.add(new Game.Tank(Game.Tank.configurations.bot1));
    Game.Tank.tanks.add(new Game.Tank(Game.Tank.configurations.bot1));
    Game.Tank.tanks.add(new Game.Tank(Game.Tank.configurations.bot2));
    Game.Tank.tanks.add(new Game.Tank(Game.Tank.configurations.bot2));
    Game.Tank.tanks.add(new Game.Tank(Game.Tank.configurations.bot3));
    Game.Tank.tanks.add(new Game.Tank(Game.Tank.configurations.bot3));

    Game.Player.start();
    Game.statusUpdate();    
}