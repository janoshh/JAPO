var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var morgan = require('morgan');
var mongoose = require('mongoose');
var jwt = require('jsonwebtoken');
var config = require('./config');
var User = require('./models/user');
var File = require('./models/file');
var fs = require('fs');
var busboy = require('connect-busboy');
var jimp = require("jimp");
var port = process.env.PORT || 8080;
// connect to database
mongoose.connect(config.database);
//
// Connect to database;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log("Connected to Database");
});
//
//
//
app.set('superSecret', config.secret);
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
                    var fileBuffer = fs.readFileSync(__dirname + "/public/pdf/pdflogo.png");
                    var thumbFileName = "pdflogo.png";
                    console.log("Writing to S3");
                    s3.putObject({
                        ACL: 'public-read'
                        , Bucket: bucket
                        , Key: thumbFileName
                        , Body: fileBuffer
                        , ContentType: 'image/png'
                    }, function (error, response) {
                        if (error) console.log(error);
                        console.log("Successfully created Bucket for user " + bucket);
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
    var tags = req.headers['tags'];
    var customFilename = req.headers['customfilename'];
    var metadata = {
        "x-amz-meta-tags": tags
    };
    var fileType;
    //
    req.pipe(req.busboy);
    req.busboy.on('file', function (fieldname, file, filename) {
        //
        var params = {
            Bucket: bucket
            , Key: filename
            , Body: file
            , ContentLength: fileSize
            , Metadata: metadata
            , ACL: 'public-read'
        };
        // Wegschrijven naar Amazon S3
        s3.upload(params, function (err, data) {
            if (err) console.log(err)
            else {
                //console.log("Succesfully added in bucket " + bucket);
                //
                var fileLocation;
                // Get Extension / Filetype
                fileType = filename.substr(filename.lastIndexOf('.') + 1);
                fileLocation = data.Location;
                //
                // Wegschrijven naar MongoDB
                file = new File({
                    user: user
                    , filename: filename
                    , customfilename: customFilename
                    , filetype: fileType
                    , size: fileSize
                    , date: Date.now()
                    , tags: tags
                    , location: fileLocation
                });
                file.save(function (err, userObj) {
                    if (err) {
                        console.log(err);
                    }
                });
                //
                //-------------------------------------------------
                // CONVERTER
                //-------------------------------------------------
                if (fileType === "jpg" || fileType === "png") {
                    console.log("CONVERTING JPG");
                    console.log("Getting file from " + fileLocation);
                    jimp.read(fileLocation, function (err, image) {
                        console.log("CREATING THUMBNAIL");
                        if (err) throw err;
                        image.resize(256, 256) // resize
                            .quality(60) // set JPEG quality
                            .write("thumbnail.jpg", function () {
                                var fileBuffer = fs.readFileSync("thumbnail.jpg");
                                var thumbFileName = "thumb_" + filename;
                                s3.putObject({
                                    ACL: 'public-read'
                                    , Bucket: bucket
                                    , Key: thumbFileName
                                    , Body: fileBuffer
                                    , ContentType: 'image/jpg'
                                }, function (error, response) {
                                    console.log("thumbnail uploaded");
                                });
                            });
                    });
                }
                //-------------------------------------------------
                res.status(200).end();
            }
        });
    });
    req.busboy.on('finish', function () {
        console.log("Upload succes!");
    });
});
app.get('/getfile', function (req, res, next) {
    var user = req.query.user;
    var bucket = user.replace("@", "-");
    var filename = req.query.file;
    //
    var params = {
        Bucket: bucket
        , Key: filename
    }

    res.writeHead(200, {
        'Content-Type': 'application/pdf'
    });

    var fileStream = s3.getObject(params).createReadStream();
    fileStream.pipe(res);
});
apiRoutes.post('/deleteaccount', function (req, res, next) {
    console.log("POST OM ACCOUNT TE DELETEN");
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    console.log("Deleting account " + user);
    //
    s3.listObjects({
        Bucket: bucket
    }, function (err, data) {
        if (err) {
            console.log("error listing bucket objects " + err);
            return;
        }
        var items = data.Contents;
        for (var i = 0; i < items.length; i += 1) {
            var deleteParams = {
                Bucket: bucket
                , Key: items[i].Key
            };
            s3.deleteObject(deleteParams, function (err, data) {
                if (err) {
                    console.log("delete err " + deleteParams.Key);
                }
                else {
                    console.log("deleted " + deleteParams.Key);
                }
            });
        }
        s3.deleteBucket({
            Bucket: bucket
        }, function (err, data) {
            if (err) {
                console.log("error deleting bucket " + err);
            }
            else {
                console.log("delete the bucket " + data);
                File.find({
                    user: user
                }).remove(function (err, data) {
                    if (err) console.log(err, err.stack);
                    else console.log("succes");
                });
                User.findOne({
                    name: user
                }).remove(function (err, data) {
                    if (err) console.log(err, err.stack);
                    else console.log("succes");
                });
                res.status(200).end();
            }
        });
    });
});
apiRoutes.post('/deleteallfiles', function (req, res, next) {
    console.log("POST OM ALLE FILES TE DELETEN");
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    console.log("Deleting all files " + user);
    //
    s3.listObjects({
        Bucket: bucket
    }, function (err, data) {
        if (err) {
            console.log("error listing bucket objects " + err);
            return;
        }
        var items = data.Contents;
        for (var i = 0; i < items.length; i += 1) {
            var deleteParams = {
                Bucket: bucket
                , Key: items[i].Key
            };
            if (deleteParams.Key != "pdflogo.png") {
                s3.deleteObject(deleteParams, function (err, data) {
                    if (err) {
                        console.log("delete err " + deleteParams.Key);
                    }
                    else {
                        console.log("deleted " + deleteParams.Key);
                        File.find({
                            user: user
                        }).remove(function (err, data) {
                            if (err) console.log(err, err.stack);
                            else console.log("succes");
                        });
                    }
                });
            }
        }
    });
});
apiRoutes.post('/deletefile', function (req, res, next) {
    console.log("POST OM FILE TE DELETEN");
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var filename = req.headers['filename'];
    console.log("Deleting file " + filename);
    //
    var params = {
        Bucket: bucket
        , Delete: {
            Objects: [
                {
                    Key: filename
                }
        ]
        }
    };
    s3.deleteObjects(params, function (err, data) {
        if (err) console.log(err, err.stack);
        else {
            console.log('delete', data);
            File.findOne({
                filename: filename
            }).remove(function (err, data) {
                if (err) console.log(err, err.stack);
                else console.log("succes");
            });
            //
            res.status(200).end();
        }
    });
});
apiRoutes.get('/getFiles', function (req, res) {
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var files = [];
    mongoose.connection.db.collection("files", function (err, collection) {
        collection.find({
            user: user
        }).toArray(function (err, data) {
            //console.log(data); // it will print your collection data
            files.push(data);
            console.log(files);
            return res.status(200).send({
                files: files
            });
        })
    });
});
app.use('/api', apiRoutes);
// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);