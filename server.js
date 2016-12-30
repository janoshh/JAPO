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
var Busboy = require('busboy');
var jimp = require("jimp");
var tesseract = require('node-tesseract');
var extract = require('pdf-text-extract');
var PDFImage = require("pdf-image").PDFImage;
var glob = require("glob");
var port = 80;
//
// Max Capacity of non-premium member:
var maxCapacity = 100000000;
var thumbnailSize = 250;
7
var dateFileSeperator = "|";
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
    var token = req.body.token || req.headers['x-access-token'];
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
apiRoutes.post('/upload', function (req, res) {
    createFilesDir();
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var uploadList = [];
    var busboy = new Busboy({
        headers: req.headers
    });
    var files = 0;
    var finished = false;
    busboy.on('file', function (fieldname, file, filename) {
        ++files;
        var dateFilename = Date.now() + dateFileSeperator + filename;
        var fs = require('fs');
        var fstream = fs.createWriteStream('./files/' + dateFilename);
        var params = {
            Bucket: bucket
            , Key: dateFilename
            , ACL: 'public-read'
        };
        uploadList.push(params);
        fstream.on('close', function () {
            if (--files === 0 && finished) {
                checkForEnoughSpace(user, uploadList, function (err) {
                    if (err === "notEnoughSpace") {
                        res.status(409).end();
                    }
                    else if (err === "error") {
                        res.status(500).end();
                    }
                    else {
                        uploadToAmazon(user, uploadList, 0);
                        return true;
                        //res.status(200);
                    }
                });
            };
        });
        file.pipe(fstream);
    });
    busboy.on('finish', function () {
        finished = true;
    });
    return req.pipe(busboy);
});

function uploadToAmazon(user, uploadList, i) {
    if (i < uploadList.length) {
        params = uploadList[i];
        var fileBuffer = fs.readFileSync("./files/" + params.Key);
        var fileSize = getFilesizeInBytes("./files/" + params.Key);
        params.ContentLength = fileSize;
        params.Body = fileBuffer;
        s3.upload(params, function (err, data) {
            if (err) {
                console.log(error);
            }
            else {
                //console.log(params.Key + " uploaded to amazon s3");
                params.fileType = params.Key.substr(params.Key.lastIndexOf('.') + 1).toLowerCase();
                params.fileLocation = data.Location;
                uploadToMongoDB(user, params);
                if (params.fileType === "pdf") {
                    getTextFromPdf(user, params);
                    pdfToImage(params);
                }
                else {
                    getTextFromImage(user, params);
                    createThumbnailFromImage(params, false);
                }
                // NEXT FILE
                uploadToAmazon(user, uploadList, ++i);
            }
        });
    }
}

function uploadToMongoDB(user, params) {
    fileMongo = new File({
        user: user
        , filename: params.Key
        , customfilename: ""
        , filetype: params.fileType
        , size: params.fileSize
        , date: Date.now()
        , tags: ""
        , location: params.fileLocation
        , content: ""
    });
    fileMongo.save(function (err, userObj) {
        if (err) {
            console.log(err);
        }
    });
}

function getTextFromPdf(user, params) {
    var extract = require('pdf-text-extract');
    extract("./files/" + params.Key, function (err, pages) {
        if (err) {
            console.dir(err);
            return
        }
        File.findOne({
            user: user
            , filename: params.Key
        }, function (err, doc) {
            if (doc) {
                doc.content = pages.toString();
                doc.save();
                compareAllFiles(user, params.Key, pages.toString());
            }
            else {
                console.log("No file found");
            }
        });
    })
}

function getTextFromImage(user, params) {
    jimp.read(params.fileLocation, function (err, image) {
        var pngFile = "./files/pngtemp.png";
        image.write(pngFile, function () {
            // Recognize text of any language in any format
            tesseract.process(pngFile, function (err, text) {
                if (err) {
                    console.error(err);
                }
                else {
                    File.findOne({
                        user: user
                        , filename: params.Key
                    }, function (err, doc) {
                        doc.content = text;
                        doc.save();
                        compareAllFiles(user, params.Key, text);
                    });
                }
            });
        });
    });
}

function createThumbnailFromImage(params, pdf) {
    var file;
    if (pdf) {
        file = "./files/" + params.Key.substr(0, params.Key.lastIndexOf(".")) + "-0.jpg";
    }
    else {
        file = "./files/" + params.Key;
    }
    jimp.read(file, function (err, image) {
        if (err) {
            throw err;
        }
        image.resize(thumbnailSize, thumbnailSize) // resize
            .quality(60) // set JPEG quality
            .write("./files/" + params.Key + "_thumb.jpg", function () {
                var fileBuffer = fs.readFileSync("./files/" + params.Key + "_thumb.jpg");
                var thumbFileName = "thumb_" + params.Key;
                s3.putObject({
                    ACL: 'public-read'
                    , Bucket: params.Bucket
                    , Key: thumbFileName
                    , Body: fileBuffer
                    , ContentType: 'image/jpg'
                }, function (error, response) {
                    if (error) {
                        console.log(error);
                    }
                    // DELETE TEMPORARY FILES FROM SERVER
                    fileSubstr = params.Key.substr(0, params.Key.indexOf(dateFileSeperator));
                    /*
                    glob("./files/"+fileSubstr+"*", function (er, files) {
                        for (i=0;i<files.length;i++) {
                            fs.unlinkSync(files[i]);
                        }
                    })
                    */
                });
            });
    });
}

function pdfToImage(params) {
    var pdfImage = new PDFImage("./files/" + params.Key);
    pdfImage.setConvertExtension("jpg");
    pdfImage.convertPage(0).then(function (imagePath) {
        createThumbnailFromImage(params, true);
    });
}

function getFilesizeInBytes(filename) {
    var stats = fs.statSync(filename)
    var fileSizeInBytes = stats["size"]
    return fileSizeInBytes
}

function createFilesDir() {
    var fs = require('fs');
    var dir = './files';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
}

function checkForEnoughSpace(user, uploadList, callback) {
    var capacityUsed = 0;
    File.find({
        user: user
    }, function (err, filedata) {
        if (err) {
            throw err;
            callback("error");
            return false;
        }
        else {
            User.find({
                name: user
            }, function (err, userdata) {
                if (err) {
                    throw err;
                    callback("error");
                    return false;
                }
                else {
                    if (userdata[0].premium === false) {
                        for (var i = 0; i < filedata.length; i += 1) {
                            capacityUsed += parseInt(filedata[i].size);
                        }
                        for (var i = 0; i < uploadList.length; i += 1) {
                            var fileSize = getFilesizeInBytes(uploadList[i].filename);
                            capacityUsed += parseInt(fileSize);
                        }
                        if (capacityUsed > maxCapacity) {
                            callback("notEnoughSpace");
                            return false;
                        }
                        else {
                            callback(null);
                            return true;
                        }
                    }
                    else {
                        callback(null);
                        return true;
                    }
                }
            });
        }
    });
}

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
                    var newLink = {
                        filename: linkName
                        , percentage: match
                    };
                    links.push(newLink);
                }
            }
        }
        if (links.length > 0) {
            File.findOne({
                user: user
                , filename: currentName
            }, function (err, doc) {
                if (err) throw (err);
                else {
                    var j = 0;
                    for (j = 0; j < links.length; j++) {
                        doc.links.push(links[j]);
                    }
                    doc.save();
                }
            });
            var i = 0;
            updateLinks(user, links, currentName, i);
        }
    });
}
var updateLinks = function (user, links, currentName, i) {
    var currentLinkName = links[i].filename;
    var currentLinkPercentage = links[i].percentage;
    File.findOne({
        user: user
        , filename: currentLinkName
    }, function (err, doc) {
        if (err) throw (err);
        else {
            var newLink = {
                filename: currentName
                , percentage: currentLinkPercentage
            };
            doc.links.push(newLink);
            doc.save(function (err, product) {
                if (++i < links.length) {
                    updateLinks(user, links, currentName, i);
                }
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
                var filename = req.headers['filename'];
                var file = fs.readFileSync("temp.jpg");
                var params = {
                    Bucket: bucket
                    , Key: filename
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
                        jimp.read(fileLocation, function (err, image) {
                            if (err) throw err;
                            image.resize(thumbnailSize, thumbnailSize) // resize
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
                                        if (error) console.log(error);
                                    });
                                });
                        });
                        jimp.read(fileLocation, function (err, image) {
                            image.write("temp.png", function () {
                                // Recognize text of any language in any format
                                tesseract.process("temp.png", function (err, text) {
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
                                        res.status(200).end();
                                        compareAllFiles(user, filename, text);
                                    }
                                });
                            });
                        });
                        // END JIMP
                    }
                });
            }
        });
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
apiRoutes.post('/updatefile', function (req, res, next) {
    var user = req.headers['user'];
    var filename = req.headers['filename'];
    var customfilename = req.headers['customfilename'];
    var tags = req.headers['tags'];
    File.findOne({
        user: user
        , filename: filename
    }, function (err, doc) {
        if (err) console.log(err);
        doc.customfilename = customfilename
        doc.tags = tags;
        doc.save();
        res.status(200).end();
    });
});
apiRoutes.post('/updateuser', function (req, res, next) {
    var user = req.headers['user'];
    var oldPassword = req.headers['oldpassword'];
    var newPassword = req.headers['newpassword'];
    var premium = req.headers['premium'];
    User.findOne({
        name: user
    }, function (err, doc) {
        if (err) console.log(err);
        if (newPassword.length > 0) {
            if (doc.password === oldPassword) {
                doc.password = newPassword;
            }
            else {
                res.status(409).end();
                return;
            }
        }
        if (premium === "on") {
            doc.premium = true;
        }
        else {
            doc.premium = false;
        }
        doc.save();
        res.status(200).end();
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
                File.find({
                    user: user
                }, function (err, docs) {
                    if (err) console.log(err);
                    else {
                        for (i = 0; i < docs.length; i++) {
                            for (j = 0; j < docs[i].links.length; j++) {
                                if (docs[i].links[j].filename === filename) {
                                    docs[i].links.splice(j, 1);
                                    docs[i].save();
                                }
                            }
                        }
                    }
                })
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
    var premium = false;
    User.findOne({
        name: user
    }, function (err, doc) {
        if (err) throw err;
        else {
            premium = doc.premium;
            mongoose.connection.db.collection("files", function (err, collection) {
                collection.find({
                    user: user
                }).toArray(function (err, data) {
                    files.push(data);
                    return res.status(200).send({
                        files: files
                        , premium: premium
                    });
                })
            });
        }
    })
});
app.get('/getFileInformation', function (req, res) {
    var user = req.query.user;
    var filename = req.query.filename;
    File.findOne({
        user: user
        , filename: filename
    }, function (err, doc) {
        if (err) throw err;
        else {
            return res.status(200).send({
                fileInfo: doc
            });
        }
    })
});
app.use('/api', apiRoutes);
// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);