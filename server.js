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
var tesseract = require('node-tesseract');
var port = 80;
//
// Max Capacity of non-premium member:
var maxCapacity = 100000000;
//
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
                // CREATE S3 BUCKET FOR USER
                s3.createBucket({
                    Bucket: bucket
                }, function () {
                    var token = jwt.sign(name, app.get('superSecret'));
                    res.status(200);
                    res.json({
                        success: true
                        , message: 'Enjoy your token!'
                        , token: token
                    });
                });
            });
        }
        else {
            res.status(409);
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
    var capacityUsed = 0;
    console.log(fileSize);
    console.log(user);
    // Check is non-premium user has enough storage capacity left to upload new file
    File.find({
        user: user
    }, function (err, filedata) {
        if (err) throw err;
        else {
            User.find({
                name: user
            }, function (err, userdata) {
                if (err) throw err;
                else {
                    if (userdata[0].premium === false) {
                        for (var i = 0; i < filedata.length; i += 1) {
                            capacityUsed += parseInt(filedata[i].size);
                        }
                        capacityUsed += parseInt(fileSize);
                        if (capacityUsed > maxCapacity) {
                            res.status(409).end();
                            return false;
                        }
                        else {
                            var bucket = user.replace("@", "-");
                            var tags = req.headers['tags'];
                            var customFilename = req.headers['customfilename'];
                            console.log(tags);
                            console.log(customFilename);
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
                                            , content: ""
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
                                        var ft = fileType.toLowerCase();
                                        if (ft === "jpg" || ft === "png" || ft === "jpeg") {
                                            jimp.read(fileLocation, function (err, image) {
                                                if (err) throw err;
                                                image.write("temp.jpg", function () {
                                                    // Recognize text of any language in any format
                                                    tesseract.process("temp.jpg", function (err, text) {
                                                        if (err) {
                                                            console.error(err);
                                                        }
                                                        else {
                                                            File.findOne({
                                                                user: user
                                                                , filename: filename
                                                            }, function (err, doc) {
                                                                doc.content = text;
                                                                doc.save();
                                                            });
                                                        }
                                                        compareAllFiles(user, filename, text);
                                                    });
                                                    jimp.read("temp.jpg", function (err, image) {
                                                        if (err) throw err;
                                                        image.resize(242, 243) // resize
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
                                                                    res.status(200).end();
                                                                });
                                                            });
                                                    });
                                                });
                                            });
                                        }
                                        else {
                                            //-------------------------------------------------
                                            res.status(200).end();
                                        }
                                    }
                                });
                            });
                        }
                    }
                }
            });
        }
    });
});

function compareAllFiles(user, filename, currentContent) {
    File.find({
        user: user
    }, function (err, files) {
        var newFile;
        for (i = 0; i < files.length; i++) {
            if (files[i].filename === filename) {
                newFile = i;
            }
        }
        var f1 = currentContent;
        var links = [];
        for (i = 0; i < files.length; i++) {
            var linkName = files[i].filename;
            var currentName = files[newFile].filename;
            if (currentName != linkName) {
                var f2 = files[i].content;
                var match = Math.round(comareFiles(f1, f2) * 100);
                if (match > 60) {
                    links.push(linkName);
                }
            }
        }
        console.log(links);
        File.findOne({
            user: user
            , filename: currentName
        }, function (err, doc) {
            for (j = 0; j < links.length; j++) {
                doc.links.push(links[j]);
            }
            doc.save();
        });
        for (j = 0; j < links.length; j++) {
            var index = j;
            File.findOne({
                user: user
                , filename: links[j]
            }, function (err, doc) {
                doc.links.push(currentName);
                doc.save();
            });
        }
    });
}

function comareFiles(s1, s2) {
    var longer = s1;
    var shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }
    var longerLength = longer.length;
    if (longerLength == 0) {
        return 1.0;
    }
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    var costs = new Array();
    for (var i = 0; i <= s1.length; i++) {
        var lastValue = i;
        for (var j = 0; j <= s2.length; j++) {
            if (i == 0) costs[j] = j;
            else {
                if (j > 0) {
                    var newValue = costs[j - 1];
                    if (s1.charAt(i - 1) != s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}
apiRoutes.post('/uploadimage', function (req, res, next) {
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var dataString = '';
    req.on('data', function (data) {
        dataString += data;
    });
    req.on('end', function () {
        fs = require('fs');
        fs.writeFile('log.txt', dataString, function (err) {
            if (err) return console.log(err);
        });
        dataString = dataString.substring(dataString.indexOf("8bit") + 4);
        dataString = dataString.substring(0, dataString.indexOf("--"));
        require("fs").writeFile("temp.jpg", dataString, 'base64', function (err) {
            if (err) console.log(err);
            else {
                var fileSize = req.headers['file-size'];
                var tags = req.headers['tags'];
                var customFilename = req.headers['customfilename'];
                var filename = customFilename + '.jpg'
                var file = fs.readFileSync("temp.jpg");
                var params = {
                    Bucket: bucket
                    , Key: customFilename
                    , Body: file
                    , ACL: 'public-read'
                };
                // Wegschrijven naar Amazon S3
                s3.upload(params, function (err, data) {
                    if (err) console.log(err)
                    else {
                        //
                        var fileLocation;
                        // Get Extension / Filetype
                        fileType = ".jpg"
                        fileLocation = data.Location;
                        //
                        // Wegschrijven naar MongoDB
                        file = new File({
                            user: user
                            , filename: customFilename
                            , customfilename: customFilename
                            , filetype: fileType
                            , size: fileSize
                            , date: Date.now()
                            , tags: tags
                            , location: fileLocation
                            , content: ""
                        });
                        file.save(function (err, userObj) {
                            if (err) {
                                console.log(err);
                            }
                        });
                        jimp.read("temp.jpg", function (err, image) {
                            if (err) throw err;
                            // Recognize text of any language in any format
                            tesseract.process("temp.jpg", function (err, text) {
                                if (err) {
                                    console.error(err);
                                }
                                else {
                                    File.findOne({
                                        user: user
                                        , filename: filename
                                    }, function (err, doc) {
                                        doc.content = text;
                                        doc.save();
                                    });
                                }
                                compareAllFiles(user, filename, text);
                            });
                            image.resize(242, 243) // resize
                                .quality(60) // set JPEG quality
                                .write("thumbnail.jpg", function () {
                                    var fileBuffer = fs.readFileSync("thumbnail.jpg");
                                    var thumbFileName = "thumb_" + filename + ".jpg";
                                    s3.putObject({
                                        ACL: 'public-read'
                                        , Bucket: bucket
                                        , Key: thumbFileName
                                        , Body: fileBuffer
                                        , ContentType: 'image/jpg'
                                    }, function (error, response) {
                                        res.status(200).end();
                                    });
                                });
                        });
                    }
                });
            }
        });
    });
});
app.post('/pdfthumbnail', function (req, res, next) {
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var filename = req.headers['filename'];
    var dataString = '';
    req.on('data', function (data) {
        dataString += data;
    });
    req.on('end', function () {
        var base64Data = dataString.replace(/^data:image\/png;base64,/, "");
        require("fs").writeFile("temp.png", base64Data, 'base64', function (err) {
            if (err) console.log(err);
            else {
                jimp.read("temp.png", function (err, image) {
                    if (err) throw err;
                    image.resize(242, 243) // resize
                        .quality(60) // set JPEG quality
                        .write("thumbnail.jpg", function () {
                            var fileBuffer = fs.readFileSync("thumbnail.jpg");
                            var thumbFileName = "thumb_" + filename + ".jpg";
                            s3.putObject({
                                ACL: 'public-read'
                                , Bucket: bucket
                                , Key: thumbFileName
                                , Body: fileBuffer
                                , ContentType: 'image/jpg'
                            }, function (error, response) {
                                res.status(200).end();
                            });
                        });
                });
            }
        });
    });
});
app.post('/pdftext', function (req, res, next) {
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var filename = req.headers['filename'];
    var dataString = '';
    req.on('data', function (data) {
        dataString += data;
    });
    req.on('end', function () {
        File.findOne({
            user: user
            , filename: filename
        }, function (err, doc) {
            doc.content = dataString;
            doc.save();
        });
        res.status(200).end();
        compareAllFiles(user, filename, dataString);
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
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    console.log("Deleting account " + user);
    //
    var counter = 0;
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
                if (err) console.log("delete err " + deleteParams.Key);
                counter++;
                if (items.length === counter) {
                    s3.deleteBucket({
                        Bucket: bucket
                    }, function (err, data) {
                        if (err) {
                            console.log("error deleting bucket " + err);
                        }
                        else {
                            File.find({
                                user: user
                            }).remove(function (err, data) {
                                if (err) console.log(err, err.stack);
                            });
                            User.findOne({
                                name: user
                            }).remove(function (err, data) {
                                if (err) console.log(err, err.stack);
                            });
                            res.status(200).end();
                        }
                    });
                }
            });
        }
    });
});
apiRoutes.post('/deleteallfiles', function (req, res, next) {
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    console.log("Deleting all files " + user);
    //
    s3.listObjects({
        Bucket: bucket
    }, function (err, data) {
        if (err) {
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
                    File.find({
                        user: user
                    }).remove(function (err, data) {
                        if (err) console.log(err, err.stack);
                    });
                    res.status(200).end();
                }
            });
        }
    });
});
apiRoutes.post('/deletefile', function (req, res, next) {
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var filename = req.headers['filename'];
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
            File.findOne({
                filename: filename
            }).remove(function (err, data) {
                if (err) console.log(err, err.stack);
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
            files.push(data);
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