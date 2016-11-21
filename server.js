var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file
var User = require('./models/user'); // get our mongoose model
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
// =================================================================
// routes ==========================================================
// =================================================================
var path = require('path');
public = __dirname + '/public/';
app.use(express.static(public));
app.get("/", function (req, res) {
    res.sendFile(public + "index.html");
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
    console.log("oooow, ne post jom");
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
                res.redirect(public + "home.html");
                /*
                res.json({
                    success: true
                    , message: 'Enjoy your token!'
                    , token: token
                });
                */
            }
        }
    });
});
apiRoutes.post('/createUser', function (req, res) {
    // getting log in data
    var name = req.body.email
    var password = req.body.password
    var succes = false;
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
app.use('/api', apiRoutes);




// MONGODB
/*

var documentsSchema = new Schema({
    name: String
    , type: String
    , content: String
    , uploadDate: {
        type: Date
        , default: Date.now
    }
});
var transactionSchema = new Schema({
    txId: ObjectId
    , txStatus: {
        type: String
        , index: true
        , default: "started"
    }
    , documents: [{
        type: ObjectId
        , ref: 'Document'
    }]
});
apiRoutes.post('/uploadFile', function (req, res) {
    function uploadFile(req, res) {
        var file = req.files.file;
        console.log(file.path);
        if (file.type != 'application/pdf') {
            res.render('./tx/application/uploadResult', {
                result: 'File must be pdf'
            });
        }
        else if (file.size > 1024 * 1024) {
            res.render('./tx/application/uploadResult', {
                result: 'File is too big'
            });
        }
        else {
            var document = new Document();
            document.name = file.name;
            document.type = file.type;
            fs.readFile(file.path, function (err, data) {
                document.content = data;
                document.save(function (err, document) {
                    if (err) throw err;
                    Transaction.findById(req.body.ltxId, function (err, tx) {
                        tx.documents.push(document._id);
                        tx.save(function (err, tx) {
                            res.render('./tx/application/uploadResult', {
                                result: 'ok'
                                , fileId: document._id
                            });
                        });
                    });
                });
            });
        }
    }
});

*/


// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);