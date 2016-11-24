var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User = require('./models/user'); // get our mongoose model
var fs = require('fs');
var busboy = require('connect-busboy');
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
// connect to database
mongoose.connect(config.database);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    // we're connected!    
});
app.set('superSecret', config.secret); // secret variable
// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
// use morgan to log requests to the console
app.use(morgan('dev'));
app.use(busboy());
var path = require('path');
public = __dirname + '/public/';
app.use(express.static(public));
app.get("/", function (req, res) {
    res.sendFile(public + "index.html");
});
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
// ---------------------------------------------------------
// get an instance of the router for api routes
// ---------------------------------------------------------
var apiRoutes = express.Router();
// ---------------------------------------------------------
// authentication (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------
// http://localhost:8080/api/authenticate
apiRoutes.post('/authenticate', function (req, res) {
    // find the user
    User.findOne({
        name: req.body.name
    }, function (err, user) {
        if (err) throw err;
        debugger;
        if (!user) {
            res.status(422);
            res.json({
                success: false
                , message: 'Authentication failed. User not found.'
            });
        }
        else if (user) {
            // check if password matches
            if (user.password != req.body.password) {
                res.status(422);
                res.json({
                    success: false
                    , message: 'Authentication failed. Wrong password.'
                });
            }
            else {
                // if user is found and password is right
                // create a token
                var token = jwt.sign(user, app.get('superSecret'), {
                    expiresIn: 86400 // expires in 24 hours
                });
                //res.redirect(public + "home.html");
                res.status(200);
                res.json({
                    success: true
                    , message: 'Enjoy your token!'
                    , token: token
                });
            }
        }
    });
});
apiRoutes.post('/createUser', function (req, res) {
    // getting log in data
    var name = req.body.email
    var password = req.body.password
    var succes = false;
    var bucket = name.replace("@", "-");
    // create a new user if it doesn't exist yet
    User.findOne({
        name: req.body.email
    }, function (err, user) {
        if (err) throw err;
        if (!user) {
            var newUser = new User({
                fname: req.body.fname
                , lname: req.body.lname
                , name: req.body.email
                , password: req.body.password
                , premium: false
            });
            newUser.save(function (err, newUser) {
                if (err) return console.error(err);
                if (!err) {
                    console.log("New user saved tot db");
                    res.json({
                        success: true
                        , message: 'User created!'
                    });
                }
                // CREATE S3 BUCKET FOR USER
                s3.listBuckets(function (err, data) {
                    if (err) {
                        console.log("Error", err);
                    }
                    else {
                        console.log("Bucket List", data.Buckets);
                    }
                });
                s3.createBucket({
                    Bucket: bucket
                }, function () {
                    var params = {
                        Bucket: bucket
                        , Key: 'Welcome.pdf'
                        , Body: 'Hello and welcome to JAPO!'
                    };
                    s3.putObject(params, function (err, data) {
                        if (err) console.log(err)
                        else console.log("Successfully created Bucket for user " + bucket);
                    });
                });
            });
        }
        else {
            res.json({
                success: false
                , message: 'This email address is already been used.'
            });
        }
    });
});
// ---------------------------------------------------------
// route middleware to authenticate and check token
// ---------------------------------------------------------
apiRoutes.use(function (req, res, next) {
    // check header or url parameters or post parameters for token
    var token = req.body.token || req.param('token') || req.headers['x-access-token'];
    // decode token
    if (token) {
        // verifies secret and checks exp
        jwt.verify(token, app.get('superSecret'), function (err, decoded) {
            if (err) {
                return res.json({
                    success: false
                    , message: 'Failed to authenticate token.'
                });
            }
            else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });
    }
    else {
        // if there is no token
        // return an error
        return res.status(403).send({
            success: false
            , message: 'No token provided.'
        });
    }
});
// ---------------------------------------------------------
// authenticated routes
// ---------------------------------------------------------
apiRoutes.get('/', function (req, res) {
    res.json({
        message: 'Welcome to the coolest API on earth!'
    });
});
apiRoutes.get('/users', function (req, res) {
    User.find({}, function (err, users) {
        res.json(users);
    });
});
apiRoutes.get('/check', function (req, res) {
    res.json(req.decoded);
});
apiRoutes.post('/upload', function (req, res, next) {
    var fileSize = req.headers['file-size'];
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    console.log("Uploading file "+filename+" ("+fileSize+"b) to "+bucket);
    req.pipe(req.busboy);
    req.busboy.on('file', function (fieldname, file, filename) {
        var params = {
            Bucket: bucket
            , Key: filename
            , Body: file
            , ContentLength: fileSize
            , ACL: 'public-read'
        };
        s3.putObject(params, function (err, data) {
            if (err) console.log(err)
            else console.log("Succesfully added in bucket "+bucket);
        });
    });
    req.busboy.on('finish', function () {
        console.log("Upload succes!");
    });
});
app.use('/api', apiRoutes);
// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);