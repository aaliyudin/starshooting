var game = new Phaser.Game(640,800, Phaser.AUTO, 'Star Shooting', {preload: preload, create: create, update: update, render: render});

var player;
var starEnemies;
var starfield;
var cursors;
var bank;
var shipTrail;
var explosions;
var bullets;
var fireButton;
var bulletTimer = 0;
var health;
var score = 0;
var scoreText;
var starstarLaunchTimer;
var gameOver;

var ACCLERATION = 600;
var DRAG = 400;
var MAXSPEED = 400;

function preload() {
    game.load.image('starfield', 'assets/img/space.jpg');
    game.load.image('ship', 'assets/img/players.png', 128, 128);
    game.load.image('bullet', 'assets/img/bullet.png');
    game.load.image('star-star', 'assets/img/star.png');
    game.load.spritesheet('explosion', 'assets/img/explode.png', 128, 128);
    game.load.audio('explosion', 'assets/sfx/bomb.ogg');
    game.load.audio('bullet', 'assets/sfx/shot1.wav');
    game.load.audio('gameOverSfx', 'assets/sfx/energy-drain.ogg');
    var spaceSound = new Howl({
      src: ['assets/sfx/spaceship.wav'],
      autoplay: true,
      loop: true,
      volume: 1,
      onend: function() {
        console.log('Finished!');
      }
    });
}

function create() {
    //  The scrolling starfield background
    starfield = game.add.tileSprite(0, 0, 640, 800, 'starfield');

    //The sfx
    explosionSfx = game.add.audio('explosion');
    bulletSfx = game.add.audio('bullet');
    gameOverSfx = game.add.audio('gameOverSfx');
    //gameSound
    spaceSound = game.add.audio('space');
    spaceSound.loop = true;
    spaceSound.play('', 0, 1, true);


    //  Our bullet group
    bullets = game.add.group();
    bullets.enableBody = true;
    bullets.physicsBodyType = Phaser.Physics.ARCADE;
    bullets.createMultiple(30, 'bullet');
    bullets.setAll('anchor.x', 0.5);
    bullets.setAll('anchor.y', 1);
    bullets.setAll('outOfBoundsKill', true);
    bullets.setAll('checkWorldBounds', true);

    //  The Player!
    player = game.add.sprite(320, 750, 'ship');
    player.health = 100;
    player.anchor.setTo(0.5, 0.5);
    game.physics.enable(player, Phaser.Physics.ARCADE);
    player.body.maxVelocity.setTo(MAXSPEED, MAXSPEED);
    player.body.drag.setTo(DRAG, DRAG);
    player.events.onKilled.add(function(){
        shipTrail.kill();
    });
    player.events.onRevived.add(function(){
        shipTrail.start(false, 5000, 10);
    });

    //  The star!
    starEnemies = game.add.group();
    starEnemies.enableBody = true;
    starEnemies.physicsBodyType = Phaser.Physics.ARCADE;
    starEnemies.createMultiple(5, 'star-star');
    starEnemies.setAll('anchor.x', 0.5);
    starEnemies.setAll('anchor.y', 0.5);
    starEnemies.setAll('scale.x', 0.5);
    starEnemies.setAll('scale.y', 0.5);
    starEnemies.setAll('angle', 180);
    starEnemies.forEach(function(star){
        addstarEmitterTrail(star);
        star.body.setSize(star.width * 3 / 4, star.height * 3 / 4);
        star.damageAmount = 10;
        star.events.onKilled.add(function(){
            star.trail.kill();
        });
    });

    game.time.events.add(1000, launchStars);

    //  And some controls to play the game with mouse
    cursors = game.input.keyboard.createCursorKeys();
    fireButton = game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);

    //  Add an emitter for the ship's trail
    shipTrail = game.add.emitter(player.x, player.y + 10, 400);
    shipTrail.width = 10;
    shipTrail.makeParticles('bullet');
    shipTrail.setXSpeed(30, -30);
    shipTrail.setYSpeed(200, 180);
    shipTrail.setRotation(50,-50);
    shipTrail.setAlpha(1, 0.01, 800);
    shipTrail.setScale(0.05, 0.4, 0.05, 0.4, 2000, Phaser.Easing.Quintic.Out);
    shipTrail.start(false, 5000, 10);

    //  An explosion pool
    explosions = game.add.group();
    explosions.enableBody = true;
    explosions.physicsBodyType = Phaser.Physics.ARCADE;
    explosions.createMultiple(30, 'explosion');
    explosions.setAll('anchor.x', 0.5);
    explosions.setAll('anchor.y', 0.5);
    explosions.forEach( function(explosion) {
        explosion.animations.add('explosion');
    });

    //  Health stat
    health = game.add.text(game.world.width - 150, 10, 'Health: ' + player.health +'%', { font: '24px Arial', fill: '#fbcb15' });
    health.render = function () {
        health.text = 'Health: ' + Math.max(player.health, 0) +'%';
    };

    //  Score
    scoreText = game.add.text(10, 10, '', { font: '24px Arial', fill: '#fbcb15' });
    scoreText.render = function () {
        scoreText.text = 'Score: ' + score;
    };
    scoreText.render();

    //  Game over text
    gameOver = game.add.text(game.world.centerX, game.world.centerY, 'GAME OVER!', { font: '84px Arial', fill: '#fbcb15' });
    gameOver.anchor.setTo(0.5, 0.5);
    gameOver.visible = false;
}

function update() {
    //  Scroll the background
    starfield.tilePosition.y += 2;

    //  Reset the player, then check for movement keys
    player.body.acceleration.x = 0;

    if (cursors.left.isDown)
    {
        player.body.acceleration.x = -ACCLERATION;
    }
    else if (cursors.right.isDown)
    {
        player.body.acceleration.x = ACCLERATION;
    }

    //  Stop at screen edges
    if (player.x > game.width - 50) {
        player.x = game.width - 50;
        player.body.acceleration.x = 0;
    }
    if (player.x < 50) {
        player.x = 50;
        player.body.acceleration.x = 0;
    }

    //  Fire bullet
    if (player.alive && (fireButton.isDown || game.input.activePointer.isDown)) {
        fireBullet();
    }

    //  Move ship towards mouse pointer
    if (game.input.x < game.width - 20 &&
        game.input.x > 20 &&
        game.input.y > 20 &&
        game.input.y < game.height - 20) {
        var minDist = 200;
        var dist = game.input.x - player.x;
        player.body.velocity.x = MAXSPEED * game.math.clamp(dist / minDist, -1, 1);
    }

    //  Squish and rotate ship for illusion of "banking"
    bank = player.body.velocity.x / MAXSPEED;
    player.scale.x = 1 - Math.abs(bank) / 2;
    player.angle = bank * 30;

    //  Keep the shipTrail lined up with the ship
    shipTrail.x = player.x;

    //  Check collisions
    game.physics.arcade.overlap(player, starEnemies, shipCollide, null, this);
    game.physics.arcade.overlap(starEnemies, bullets, hitstar, null, this);

    //  Game over
    if (! player.alive && gameOver.visible === false) {
        gameOver.visible = true;
        gameOver.alpha = 0;
        var fadeInGameOver = game.add.tween(gameOver);
        fadeInGameOver.to({alpha: 1}, 1000, Phaser.Easing.Quintic.Out);
        fadeInGameOver.onComplete.add(setResetHandlers);
        fadeInGameOver.start();
        gameOverSfx.play();
        function setResetHandlers() {
            //  The "click to restart" handler
            tapRestart = game.input.onTap.addOnce(_restart,this);
            spaceRestart = fireButton.onDown.addOnce(_restart,this);
            function _restart() {
              tapRestart.detach();
              spaceRestart.detach();
              restart();
            }
        }
    }
}

function render() {
    // for (var i = 0; i < starEnemies.length; i++)
    // {
    //     game.debug.body(starEnemies.children[i]);
    // }
    // game.debug.body(player);
}

function fireBullet() {
    //  To avoid them being allowed to fire too fast we set a time limit
    if (game.time.now > bulletTimer)
    {
        var BULLET_SPEED = 400;
        var BULLET_SPACING = 250;
        //  Grab the first bullet we can from the pool
        var bullet = bullets.getFirstExists(false);
        bulletSfx.play();

        if (bullet)
        {
            //  And fire it
            //  Make bullet come out of tip of ship with right angle
            var bulletOffset = 20 * Math.sin(game.math.degToRad(player.angle));
            bullet.reset(player.x + bulletOffset, player.y);
            bullet.angle = player.angle;
            game.physics.arcade.velocityFromAngle(bullet.angle - 90, BULLET_SPEED, bullet.body.velocity);
            bullet.body.velocity.x += player.body.velocity.x;

            bulletTimer = game.time.now + BULLET_SPACING;
        }
    }
}


function launchStars() {
    var MIN_star_SPACING = 300;
    var MAX_star_SPACING = 3000;
    var star_SPEED = 300;

    var star = starEnemies.getFirstExists(false);
    if (star) {
        star.reset(game.rnd.integerInRange(0, game.width), -20);
        star.body.velocity.x = game.rnd.integerInRange(-300, 300);
        star.body.velocity.y = star_SPEED;
        star.body.drag.x = 100;

        star.trail.start(false, 800, 1);

        //  Update function for each star ship to update rotation etc
        star.update = function(){
          star.angle = 180 - game.math.radToDeg(Math.atan2(star.body.velocity.x, star.body.velocity.y));

          star.trail.x = star.x;
          star.trail.y = star.y -10;

          //  Kill enemies once they go off screen
          if (star.y > game.height + 200) {
            star.kill();
          }
        }
    }

    //  Send another star soon
    starstarLaunchTimer = game.time.events.add(game.rnd.integerInRange(MIN_star_SPACING, MAX_star_SPACING), launchStars);
}


function addstarEmitterTrail(star) {
    var starTrail = game.add.emitter(star.x, player.y - 10, 100);
    starTrail.width = 10;
    starTrail.makeParticles('explosion', [1,2,3,4,5]);
    starTrail.setXSpeed(20, -20);
    starTrail.setRotation(50,-50);
    starTrail.setAlpha(0.4, 0, 800);
    starTrail.setScale(0.01, 0.1, 0.01, 0.1, 1000, Phaser.Easing.Quintic.Out);
    star.trail = starTrail;
}


function shipCollide(player, star) {
    var explosion = explosions.getFirstExists(false);
    explosion.reset(star.body.x + star.body.halfWidth, star.body.y + star.body.halfHeight);
    explosion.body.velocity.y = star.body.velocity.y;
    explosion.alpha = 0.7;
    explosion.play('explosion', 30, false, true);
    star.kill();

    player.damage(star.damageAmount);
    health.render();
    explosionSfx.play();
}


function hitstar(star, bullet) {
    var explosion = explosions.getFirstExists(false);
    explosion.reset(bullet.body.x + bullet.body.halfWidth, bullet.body.y + bullet.body.halfHeight);
    explosion.body.velocity.y = star.body.velocity.y;
    explosion.alpha = 0.7;
    explosion.play('explosion', 30, false, true);
    explosionSfx.play();
    star.kill();
    bullet.kill()

    // Increase score
    score += star.damageAmount * 10;
    scoreText.render()
}


function restart () {
    //  Reset the enemies
    starEnemies.callAll('kill');
    game.time.events.remove(starstarLaunchTimer);
    game.time.events.add(1000, launchStars);

    //  Revive the player
    player.revive();
    player.health = 100;
    health.render();
    score = 0;
    scoreText.render();

    //  Hide the text
    gameOver.visible = false;

}
