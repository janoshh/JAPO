// =================================================================
// get the packages we need ========================================
// =================================================================
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User = require('./models/user'); // get our mongoose model
// =================================================================
// configuration ===================================================
// =================================================================
var port = process.env.PORT || 8080; // used to create, sign, and verify tokens
mongoose.connect(config.database); // connect to database
app.set('superSecret', config.secret); // secret variable
// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json());
// use morgan to log requests to the console
app.use(morgan('dev'));

app.get('/css/style.css', function(req, res){
  res.sendFile(__dirname + '/css/style.css');
});

// =================================================================
// routes ==========================================================
// =================================================================
app.get('/setup', function (req, res) {
    // create a sample user
    var japo = new User({
        name: 'japo@japo.com'
        , password: 'Japo'
        , premium: false
    });
    japo.save(function (err) {
        if (err) throw err;
        console.log('User saved successfully');
        res.json({
            success: true
        });
    });
});
var path = require('path');
app.use(express.static(__dirname + '/../'));
app.get("/", function (req, res) {
    res.sendFile(__dirname + '/' + "index.html");
});
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
        if (!user) {
            res.json({
                success: false
                , message: 'Authentication failed. User not found.'
            });
        }
        else if (user) {
            // check if password matches
            if (user.password != req.body.password) {
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
    
    var name = req.body.email
    var password = req.body.password
    
    console.log("Creating new user");
    // create a new user
    var user = new User({
        fname: req.body.fname
        , lname: req.body.lname
        , name: req.body.email
        , password: req.body.passwordConfirm
        , premium: false
    });
    user.save(function (err) {
        if (err) throw err;
        console.log('User saved successfully');
        res.sendFile(__dirname + '/' + "registered.html");
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
app.use('/api', apiRoutes);
// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);