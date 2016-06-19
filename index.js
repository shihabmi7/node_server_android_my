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


//var clients = io.of('/chat').clients();
//var clients = io.of('/chat').clients('android'); // all users from room `room`


// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);


var port = process.env.PORT || 3000;

// install mysql plug in here
// $ npm install mysql
var mysql = require('mysql');
var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'gcm_chat'
});


/*connection.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
 if (err) throw err;

 console.log('The solution is: ', rows[0].solution);
 });*/

/*connection.query('INSERT INTO users (`user_id`, `name`, `email`, `gcm_registration_id`, `created_at`) VALUES ('2311', 'klk', 'klk', 'klklkl', '')', function(err, rows, fields) {
 if (err) throw err;

 console.log('The solution is: ', rows[0].solution);
 });*/


/*var post = {user_id: '1111', socket_id: socket.id, email: 'rock@gmail.com', status: ''};
 var query = connection.query('INSERT INTO socket_users SET ?', post, function (err, result) {
 // Neat!
 if (err) throw err;
 console.log('Successfully Saved...');
 });
 console.log(query.sql);*/


/* connection.ping(function (err) {
 if (err) throw err;
 console.log('Server responded to ping');
 });
 connection.end(); */


server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom
var numUsers = 0;
var clients = [];
var online_users = [];

io.on('connection', function (socket) {
    var addedUser = false;
    var is_Online = true;

    clients.push(socket);
    console.log('one user connected: user name: ' + socket.username + "------ id : >> " + socket.id);
    //console.log('Total User List:' + clients);


    socket.on('user_registration', function (userName, email) {

        console.log('<<<<<    User_registration Called     >>>>>>>>>');

        var is_Exists = connection.query('SELECT * FROM socket_users WHERE email = ?',[email], function (error, results) {
            // Neat!
            if (error) throw error;

            if (results) {

                console.log("not null");

            }else {

                console.log("null...");
            }

            console.log("select one user sql: "+is_Exists.sql);
        });

        // insert
            /*var post = {user_id: userName, user_name:userName, socket_id: socket.id, email: email, status: is_Online};
            var insert_query = connection.query('INSERT INTO socket_users SET ?', post, function (err, result) {
                // Neat!
                if (err) throw err;
                console.log('Successfully Saved User : ' + userName +'  affectedRows  ' + result.affectedRows + ' rows');

            });
            console.log("insert sql: "+insert_query.sql);*/


        // update
            var update_value = {socket_id: socket.id, status: is_Online};
            var update_query= connection.query('UPDATE socket_users SET  ? WHERE email = ?', [update_value, email], function(err, results) {

                if (err) throw err;

                console.log("Update sql: "+'updated successfully : '+results.affectedRows+ " row affected");

            });
            console.log(update_query.sql);

        //connection.connect();

        // get all online user
        var get_online_users = connection.query('SELECT * FROM socket_users WHERE `status` = "1"',function (error, results, fields) {

            if (error) throw error;
            // online_users.push(results);
             console.log('<<<<<    Successfully got user list :  >>>>>>>>>>' );

            for (var i in results) {
                console.log('Email Id: ', results[i].email);
            }

            // broadcast messages
            io.emit('user_registration', results);

        });
        console.log("Select all online user sql: "+get_online_users.sql);
        //connection.end();
    });


    // not fired..
    socket.on('connect', function (data) {
        console.log('connect called...');
        // we tell the client to execute 'new message'
        socket.broadcast.emit('connect', {
            username: socket.username,
            numUsers: numUsers,
            socket_id: socket.id
        });
    });

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {
        console.log('new message : ' + data);
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

        console.log('Add user called...');

        socket.emit('login', {
            numUsers: numUsers
        });

        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
            username: socket.username,
            numUsers: numUsers,
            socket_id: socket.id
        });
    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {

        console.log('typing called...');

        socket.broadcast.emit('typing', {
            username: socket.username
        });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', function () {

        console.log('stop typing...');

        socket.broadcast.emit('stop typing', {
            username: socket.username
        });
    });

    // when want to send message to specific user
    socket.on('say to someone', function (socket_id, msg) {

        console.log('say to someone called...');

        socket.broadcast.to(socket_id).emit('say to someone', {
            username: socket.username,
            id: socket_id,
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
