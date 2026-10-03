const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const players = {};
let powerUp = null;

// Sabit Harita Engelleri (Duvarlar: x, y, genişlik, yükseklik)
const walls = [
    { x: 300, y: 200, w: 150, h: 40 },
    { x: 800, y: 150, w: 40, h: 200 },
    { x: 500, y: 500, w: 200, h: 40 },
    { x: 200, y: 600, w: 40, h: 150 },
    { x: 900, y: 550, w: 180, h: 40 }
];

// Güçlendirici veya Silah Kutusu Üretici
setInterval(() => {
    if (Object.keys(players).length > 0) {
        powerUp = {
            x: Math.random() * 1000 + 100,
            y: Math.random() * 600 + 100,
            type: Math.random() > 0.5 ? 'shotgun' : 'rapid' // Pompalı veya Seri Ateş
        };
        io.emit('spawnPowerUp', powerUp);
    }
}, 12000);

io.on('connection', (socket) => {
    console.log('🟢 Yeni bir oyuncu bağlandı. ID:', socket.id);

    players[socket.id] = {
        x: 200 + Math.random() * 400,
        y: 200 + Math.random() * 400,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        health: 100,
        kills: 0,
        speed: 5,
        weapon: 'normal', // normal, shotgun, rapid
        name: 'İsimsiz'
    };

    // Haritadaki duvarları yeni gelen oyuncuya gönder
    socket.emit('initWalls', walls);
    socket.emit('currentPlayers', players);
    if (powerUp) socket.emit('spawnPowerUp', powerUp);
    
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    socket.on('setPlayerName', (name) => {
        if (players[socket.id]) {
            players[socket.id].name = name.substring(0, 15); // Max 15 karakter
            io.emit('updatePlayersData', players);
        }
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            socket.broadcast.emit('playerMoved', { id: socket.id, x: movementData.x, y: movementData.y });
        }
    });

    socket.on('shoot', (bulletData) => {
        socket.broadcast.emit('playerShot', bulletData);
    });

    socket.on('playerHit', (data) => {
        let targetId = data.targetId;
        let shooterId = socket.id;

        if (players[targetId] && players[shooterId]) {
            players[targetId].health -= 15;
            
            if (players[targetId].health <= 0) {
                players[targetId].health = 100;
                players[targetId].x = 300 + Math.random() * 400;
                players[targetId].y = 300 + Math.random() * 300;
                
                players[shooterId].kills += 1;

                // Ölen oyuncuya özel ölüm ekranı sinyali gönder
                io.to(targetId).emit('playerDied', players[shooterId].name);
            }

            io.emit('updatePlayersData', players);
        }
    });

    socket.on('collectPowerUp', (type) => {
        if (players[socket.id]) {
            players[socket.id].weapon = type;
            powerUp = null;
            io.emit('removePowerUp');
            io.emit('updatePlayersData', players);
        }
    });

    socket.on('disconnect', () => {
        console.log('🔴 Oyuncu ayrıldı. ID:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = 3000;
// BURAYI DEĞİŞTİR:
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Oyun Sunucusu Çalışıyor! Port: ${PORT}`);
});