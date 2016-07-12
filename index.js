// var app = require('express')();
// var http = require('http').Server(app);
// var io = require('socket.io')(http);
//
// app.get('/', function (req, res) {
//     res.sendFile(__dirname + '/index.html');
// })
//

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

    socket.on('user_login_and_registration', function (userName, email) {

        console.log('<<<<<    user_login_and_registration Called     >>>>>>>>>');

        var is_Exists = connection.query('SELECT * FROM socket_users WHERE email = ?', [email], function (error, results) {
            // Neat!
            if (error) throw error;

            if (results.length > 0) {

                console.log("Successfully Log in : " + userName);
                // update
                var update_value = {
                    socket_id: socket.id,
                    status: is_Online
                };
                var update_query = connection.query('UPDATE socket_users SET  ? WHERE email = ?', [update_value, email], function (err, results) {

                    if (err) throw err;

                    console.log("updated successfully : " + results.affectedRows + " row affected");

                });
                // console.log(update_query.sql);
                getAllUser();


            } else {

                //console.log("null...");
                // insert
                var post = {
                    user_id: userName,
                    user_name: userName,
                    socket_id: socket.id,
                    email: email,
                    status: is_Online
                };
                var insert_query = connection.query('INSERT INTO socket_users SET ?', post, function (err, result) {
                    // Neat!
                    if (err) throw err;

                    console.log('Successfully Saved New User : ' + userName + '  affectedRows  ' + result.affectedRows + ' rows');

                });
                getAllUser();

            }

            //console.log("select one user sql: "+is_Exists.sql);
        });

        //connection.connect();
        // console.log("Select all online user sql: "+get_online_users.sql);
        //connection.end();
    });

    // not fired..
    socket.on('connect', function (data) {
        //console.log('connect called...');
        // we tell the client to execute 'new message'
        socket.broadcast.emit('connect', {
            username: socket.username,
            numUsers: numUsers,
            socket_id: socket.id
        });
    });

    // when the client emits 'new message', this listens and executes
    socket.on('new message', function (data) {
        //console.log('new message : ' + data);
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

        //console.log('Add user called...');
        socket.emit('login success', {
            numUsers: numUsers
        });

        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
            username: socket.username,
            numUsers: numUsers,
            socket_id: socket.id
        });


    });

    socket.on('ask_for_offline_message', function (email) {

        console.log('ask_for_offline_message...');
        // send offline message if any
        sentOfflineMessage(email);

    });

    socket.on('get_chat_history', function (user_email, friend_email) {

        console.log('get_chat_history...');
        // send offline message if any
        sentChatHistoryToMobile(user_email,friend_email);

    });

    // when the client emits 'typing', we broadcast it to others
    socket.on('typing', function () {

        //console.log('typing called...');

        socket.broadcast.emit('typing', {
            username: socket.username
        });
    });

    // when the client emits 'stop typing', we broadcast it to others
    socket.on('stop typing', function () {

        //console.log('stop typing...');

        socket.broadcast.emit('stop typing', {
            username: socket.username
        });
    });

    // when want to send message to specific user
    socket.on('say to someone', function (sender_email, socket_id, receiver_email, msg) {

        console.log('say to someone called...');
        // get update socket from mysql then emit message to that id
        // IF USER IS LOGGED IN THEN SEND SMS ELSE SAVE TO MYSQL
        var data = [];
        connection.query('SELECT * FROM socket_users WHERE email = ?', [receiver_email], function (error, results) {

            if (error) throw error;

            console.log(results[0]);
            data = results;

            if (results.length > 0) {

                if (results[0].status == "1") {

                    // send msg to live user
                    socket.broadcast.to(results[0].socket_id).emit('say to someone', {
                        username: socket.username,
                        id: socket_id,
                        message: msg
                    });

                    var post = {
                        sender_mail: sender_email,
                        receiver_mail: receiver_email,
                        message: msg,
                        message_status: 1
                        //arrival_time: is_Online
                    };

                    // put online message to DB
                    insertMessageIntoDB(post, 1);

                } else {

                    //  PUT offline MSG to DB
                    var post = {
                        sender_mail: sender_email,
                        receiver_mail: receiver_email,
                        message: msg,
                        message_status: 0

                    };

                    insertMessageIntoDB(post, 0);
                }
            }

        });

    });

    // when the user disconnects.. perform this
    socket.on('disconnect', function () {

        //clients.splice(clients.indexOf(socket), 1);

        // update status : online to offline
        setStatusOfflineWhenUserLeft();

        if (addedUser) {
            --numUsers;

            // get all online user
            getAllOnlineUser();

            // echo globally that this client has left
            socket.broadcast.emit('user left', {
                username: socket.username,
                numUsers: numUsers
            });

        }


    });

    function sentOfflineMessage(receiver_email) {

        var data = [];
        connection.query('SELECT * FROM socket_messages WHERE receiver_mail = ?', [receiver_email], function (error, results) {

            if (error) throw error;

            console.log('<<<<<    Successfully got messages : Total ' + results.length);

            /*for (var i in results) {
             console.log('Message:  ', results[i].message);
             }*/

            // broadcast messages
            io.emit('getOfflineMessage', results);

        });
    }
    function sentChatHistoryToMobile(user_email,friend_email) {

        var data = "(sender_mail,receiver_mail)";

        // select * from chathistory where userid in (1,2)
        // SELECT * FROM socket_messages WHERE sender_mail in (`sender_mail`,`receiver_mail`)
        // SELECT * FROM socket_messages WHERE sender_mail in ('sam@gmail.com','shihab@gmail.com')

        // TODO : NEED TO WORK 
        connection.query('SELECT * FROM socket_messages WHERE sender_mail in ?', [data], function (error, results) {

            if (error) throw error;

            console.log('<<<<<    Successfully got messages : Total ' + results.length);

            /*for (var i in results) {
             console.log('Message:  ', results[i].message);
             }*/

            // broadcast messages
            io.emit('get_chat_history', results);

        });

        connection.query(sql, function(err, results) {
            // ...
        });


    }
    function setStatusOfflineWhenUserLeft() {

        var update_value = {status: false};
        var online_to_offline_query = connection.query('UPDATE socket_users SET  ? WHERE socket_id = ?', [update_value, socket.id], function (err, results) {

            if (err) throw err;

            console.log("Update sql: " + 'updated successfully : ' + results.affectedRows + " row affected" + ' Disconnected... ' + socket.id);

        });
        console.log(online_to_offline_query.sql);

    }
    // get all online user
    function getAllOnlineUser() {

        var get_online_users = connection.query('SELECT * FROM socket_users WHERE `status` = "1"', function (error, results) {

            if (error) throw error;
            // online_users.push(results);
            console.log('<<<<<    Successfully got user list :  >>>>>>>>>>');
            // for (var i in results) {
            //     console.log('Email Id: ', results[i].email);
            // }

            // broadcast messages
            io.emit('user_registration', results);

        });

    }
    function getAllUser() {

        var get_online_users = connection.query('SELECT * FROM socket_users ', function (error, results) {

            if (error) throw error;
            // online_users.push(results);
            console.log('<<<<<    Successfully got user list :  >>>>>>>>>>');
            /* for (var i in results) {
             console.log('Email Id: ', results[i].email  +""+results[i].last_seen);
             }*/

            // broadcast messages
            io.emit('user_registration', results);

        });

    }
    function insertMessageIntoDB(post, status) {

        var insert_query = connection.query('INSERT INTO socket_messages SET ?', post, function (err, result) {
            // Neat!
            if (err) throw err;

            if (status == 0) {
                console.log('User is Offline, Saved Offline message ,  affectedRows  ' + result.affectedRows + ' rows');
            } else {
                console.log('User is Online, Saved Online message also,  affectedRows  ' + result.affectedRows + ' rows');
            }

        });

    }
});
