// var app = require('express')();
// var http = require('http').Server(app);
// var io = require('socket.io')(http);
//
// app.get('/', function (req, res) {
//     res.sendFile(__dirname + '/index.html');
// })
//
// io.on('connection', function (socket) {
//
//     console.log('one user connected ' + socket.id);
//
//     socket.on('message', function (data) {
//         var sockets = io.sockets.sockets;
//         sockets.forEach(function (sock) {
//             if (sock.id != socket.id) {
//                 sock.emit('message', data);
//             }
//         })
//         socket.broadcast.emit('message', data);
//     })
//
//     socket.on('say to someone', function (id, msg) {
//         socket.broadcast.to(id).emit('my message', msg);
//     });
//
//
//     socket.on('disconnect', function () {
//         console.log('one user disconnected ' + socket.id);
//     })
// });
//
//
// http.listen(3000, function () {
//     console.log('server listening on port 3000');
// });

// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

//var clients = io.of('/chat').clients();
//var clients = io.of('/chat').clients('android'); // all users from room `room`

var port = process.env.PORT || 3000;

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

var numUsers = 0;
var clients = [];

io.on('connection', function (socket) {
    var addedUser = false;
    clients.push(socket);

    console.log('one user connected: user name:' +socket.username +" id : "+ socket.id);
    console.log('Total User List:' + clients);

    socket.on('connect', function (data) {
        // we tell the client to execute 'new message'
        socket.broadcast.emit('connect', {
            username: socket.username,
            numUsers: numUsers,
            socket_id:socket.id
        });
    });

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {
        // we tell the client to execute 'new message'
        socket.broadcast.emit('new message', {
            username: socket.username,
            message: data
        });
    });

    // when the client emits 'add user', this listens and executes
    socket.on('add user', function (username) {
        if (addedUser) return;

        // we store the username in the socket session for this client
        socket.username = username;
        ++numUsers;
        addedUser = true;
        socket.emit('login', {
            numUsers: numUsers
        });
        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
            username: socket.username,
            numUsers: numUsers,
            socket_id:socket.id
        });
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {
        socket.broadcast.emit('typing', {
            username: socket.username
        });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', function () {
        socket.broadcast.emit('stop typing', {
            username: socket.username
        });
    });

    socket.on('say to someone', function (id, msg) {

        socket.broadcast.to(id).emit('say to someone', {
            username: socket.username,
            id:id,
            message: msg
        });

    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function () {

        clients.splice(clients.indexOf(socket), 1);
        console.log('Disconnected... ' + socket.id);
        if (addedUser) {
            --numUsers;
            // echo globally that this client has left
            socket.broadcast.emit('user left', {
                username: socket.username,
                numUsers: numUsers
            });
        }
    });
});
