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
        if (err) console.log(err);
        else if (!user) {
            res.json({
                success: false
                , message: 'Authentication failed. User not found.'
            });
            res.status(422);
        }
        else if (user) {
            // check if password matches
            if (user.password != req.body.password) {
                res.json({
                    success: false
                    , message: 'Authentication failed. Wrong password.'
                });
                res.status(422);
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
                res.status(200);
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
        if (err) console.log(err);
        else if (!user) {
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
request = require('request');
//
var download = function (uri, filename, callback) {
    request.head(uri, function (err, res, body) {
        var type = res.headers['content-type'];
        var extension = "." + type.split("/")[1];
        request(uri).pipe(fs.createWriteStream(__dirname + '/files/' + filename + extension)).on('close', function () {
            callback(extension);
        });
    });
};
apiRoutes.post('/upload', function (req, res) {
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var filename = req.headers['filename'];
    var url = req.headers['url'];
    var uploadList = [];
    if (url) {
        var dateFilename = Date.now() + dateFileSeperator + filename;
        download(url, dateFilename, function (filetype) {
            if (filetype === ".pdf" || filetype === ".jpg" || filetype === ".jpeg" || filetype === ".png") {
                console.log('Download done');
                var params = {
                    Bucket: bucket
                    , Key: dateFilename + filetype
                    , ACL: 'public-read'
                };
                uploadList.push(params);
                checkForEnoughSpace(user, uploadList, function (err) {
                    if (err === "notEnoughSpace") {
                        res.status(409).end();
                    }
                    else if (err === "error") {
                        res.status(500).end();
                    }
                    else {
                        uploadToAmazon(user, uploadList, 0);
                        res.status(200).end();
                    }
                });
            }
            else {
                res.status(500).end();
            }
        });
    }
    else {
        var busboy = new Busboy({
            headers: req.headers
        });
        var files = 0;
        var finished = false;
        busboy.on('file', function (fieldname, file, filename) {
            ++files;
            var dateFilename = Date.now() + dateFileSeperator + filename;
            var fs = require('fs');
            var fstream = fs.createWriteStream(__dirname + '/files/' + dateFilename);
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
                            res.status(200).end();
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
    }
});

function uploadToAmazon(user, uploadList, i) {
    if (i < uploadList.length) {
        params = uploadList[i];
        var fileBuffer = fs.readFileSync(__dirname + "/files/" + params.Key);
        var fileSize = getFilesizeInBytes(__dirname + "/files/" + params.Key);
        params.ContentLength = fileSize;
        params.Body = fileBuffer;
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
        , size: params.ContentLength
        , date: Date.now()
        , tags: ""
        , location: params.fileLocation
        , content: ""
        , lastOpened: ""
    });
    fileMongo.save(function (err, userObj) {
        if (err) {
            console.log(err);
        }
    });
}

function getTextFromPdf(user, params) {
    var extract = require('pdf-text-extract');
    extract(__dirname + "/files/" + params.Key, function (err, pages) {
        if (err) {
            console.dir(err);
            return
        }
        else {
            File.findOne({
                user: user
                , filename: params.Key
            }, function (err, doc) {
                if (err) {}
                else if (doc) {
                    var text = pages.toString();
                    text = text.replace(/(?:\r\n|\r|\n)/g, '');                    
                    text.replace(/ +(?= )/g,'');
                    doc.content = text;
                    doc.save();
                    if (pages.toString().length > 0) {
                        compareAllFiles(user, params.Key, pages.toString());
                    }
                }
                else {
                    console.log("No file found");
                }
            });
        }
    })
}

function getTextFromImage(user, params) {
    jimp.read(params.fileLocation, function (err, image) {
        var pngFile = __dirname + "/files/pngtemp.png";
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
                        if (err) {
                            console.log(err)
                        }
                        text = text.replace(/(?:\r\n|\r|\n)/g, '');
                        text = text.replace(/ +(?= )/g,'');
                        doc.content = text;
                        doc.save();
                        if (text.length > 0) {
                            compareAllFiles(user, params.Key, text);
                        }
                    });
                }
            });
        });
    });
}

function createThumbnailFromImage(params, pdf) {
    var file;
    if (pdf) {
        file = __dirname + "/files/" + params.Key.substr(0, params.Key.lastIndexOf(".")) + "-0.jpg";
    }
    else {
        file = __dirname + "/files/" + params.Key;
    }
    jimp.read(file, function (err, image) {
        if (err) {
            console.log(err);
        }
        else {
            image.resize(thumbnailSize, thumbnailSize) // resize
                .quality(60) // set JPEG quality
                .write(__dirname + "/files/" + params.Key + "_thumb.jpg", function () {
                    var fileBuffer = fs.readFileSync(__dirname + "/files/" + params.Key + "_thumb.jpg");
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
                        /*
                        fileSubstr = params.Key.substr(0, params.Key.indexOf(dateFileSeperator));
                        
                        glob("./files/"+fileSubstr+"*", function (er, files) {
                            for (i=0;i<files.length;i++) {
                                fs.unlinkSync(files[i]);
                            }
                        })
                        */
                    });
                });
        }
    });
}

function pdfToImage(params) {
    var pdfImage = new PDFImage(__dirname + "/files/" + params.Key);
    pdfImage.setConvertExtension("jpg");
    pdfImage.convertPage(0).then(function (imagePath) {
        createThumbnailFromImage(params, true);
    });
}

function getFilesizeInBytes(filename) {
    console.log(filename);
    var stats = fs.statSync(filename)
    var fileSizeInBytes = stats["size"]
    return fileSizeInBytes
}

function createFilesDir() {
    var fs = require('fs');
    var dir = __dirname + '/files';
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
        console.log("Files directory added");
    }
}

function checkForEnoughSpace(user, uploadList, callback) {
    var capacityUsed = 0;
    File.find({
        user: user
    }, function (err, filedata) {
        if (err) {
            console.log(err);
            callback("error");
            return false;
        }
        else {
            User.find({
                name: user
            }, function (err, userdata) {
                if (err) {
                    console.log(err);
                    callback("error");
                    return false;
                }
                else {
                    if (userdata[0].premium === false) {
                        for (var i = 0; i < filedata.length; i += 1) {
                            capacityUsed += parseInt(filedata[i].size);
                        }
                        for (var i = 0; i < uploadList.length; i += 1) {
                            var fileSize = getFilesizeInBytes(__dirname + "/files/" + uploadList[i].Key);
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
                if (match >= 60) {
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
            updateLinks(user, links, currentName, 0);
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
        if (err) console.log(err);
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
            if (err) {
                return console.log(err);
                res.status(500).end();
            }
        });
        dataString = dataString.substring(dataString.indexOf("8bit") + 4);
        dataString = dataString.substring(0, dataString.indexOf("--"));
        require("fs").writeFile("temp.jpg", dataString, 'base64', function (err) {
            if (err) {
                console.log(err);
                res.status(500).end();
            }
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
                    if (err) {
                        console.log(err);
                        res.status(500).end();
                    }
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
                                res.status(500).end();
                            }
                        });
                        jimp.read(fileLocation, function (err, image) {
                            if (err) console.log(err);
                            else {
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
                                            if (error) {
                                                console.log(error);
                                                res.status(500).end();
                                            }
                                        });
                                    });
                            }
                        });
                        jimp.read(fileLocation, function (err, image) {
                            image.write("temp.png", function () {
                                // Recognize text of any language in any format
                                tesseract.process("temp.png", function (err, text) {
                                    if (err) {
                                        res.status(500).end();
                                        console.error(err);
                                    }
                                    else {
                                        File.findOne({
                                            user: user
                                            , filename: filename
                                        }, function (err, doc) {
                                            if (err) {
                                                res.status(500).end();
                                            }
                                            doc.content = text;
                                            doc.save();
                                        });
                                        res.status(200).end();
                                        if (text.lengt > 0) {
                                            compareAllFiles(user, filename, text);
                                        }
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
        else if (data) {
            var items = data.Contents;
            if (items.length > 0) {
                for (var i = 0; i < items.length; i += 1) {
                    var deleteParams = {
                        Bucket: bucket
                        , Key: items[i].Key
                    };
                    s3.deleteObject(deleteParams, function (err, data) {
                        if (err) console.log("delete err " + deleteParams.Key);
                        counter++;
                        if (items.length === counter) {
                            deleteAmazonBucket(bucket, user, function () {
                                res.status(200).end();
                            });
                        }
                    });
                }
            }
        }
        else {
            deleteAmazonBucket(bucket, user, function () {
                res.status(200).end();
            });
        }
    });
});

function deleteAmazonBucket(bucket, user, callback) {
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
                if (err) {
                    console.log(err, err.stack);
                }
            });
            User.findOne({
                name: user
            }).remove(function (err, data) {
                if (err) {
                    console.log(err, err.stack);
                }
            });
            callback();
        }
    });
}
apiRoutes.post('/updatefile', function (req, res, next) {
    var user = req.headers['user'];
    var filename = req.headers['filename'];
    var customfilename = req.headers['customfilename'];
    var tags = req.headers['tags'];
    File.findOne({
        user: user
        , filename: filename
    }, function (err, doc) {
        if (err) {
            console.log(err);
            res.status(409).end();
        }
        else if (doc) {
            doc.customfilename = customfilename
            doc.tags = tags
            doc.save();
            res.status(200).end();
        }
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
        if (err) {
            console.log(err);
            res.status(409).end();
        }
        else {
            if (doc) {
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
            }
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
            res.status(500).end();
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
                    res.status(500).end();
                    console.log("delete err " + deleteParams.Key);
                }
                else {
                    File.find({
                        user: user
                    }).remove(function (err, data) {
                        if (err) {
                            console.log(err, err.stack);
                            res.status(500).end();
                        }
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
                }, {
                    Key: "thumb_" + filename
                }
        ]
        }
    };
    s3.deleteObjects(params, function (err, data) {
        if (err) {
            console.log(err, err.stack);
            res.status(500).end();
        }
        else {
            File.findOne({
                filename: filename
            }).remove(function (err, data) {
                if (err) {
                    console.log(err, err.stack);
                    res.status(500).end();
                }
                File.find({
                    user: user
                }, function (err, docs) {
                    if (err) {
                        console.log(err);
                        res.status(500).end();
                    }
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
        if (err) {
            console.log(err);
            res.status(500).end();
        }
        else if (doc) {
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
        else {
            res.status(404).end();
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
        if (err) {
            console.log(err);
            res.status(500).end();
        }
        else {
            return res.status(200).send({
                fileInfo: doc
            });
        }
    })
});
apiRoutes.post('/createManualLinks', function (req, res) {
    var user = req.headers['user'];
    var bucket = user.replace("@", "-");
    var receivedData = '';
    var files = [];
    req.on('data', function (data) {
        receivedData += data;
    });
    req.on('end', function () {
        try {
            files = JSON.parse(receivedData);
            createLink(files, user, 0);
            res.status(200).end();
        }
        catch (ex) {
            console.error(ex);
            res.status(500).end();
        }
    });
});

function createLink(list, user, i) {
    if (i <= list.length) {
        File.findOne({
            user: user
            , filename: list[i].name
        }, function (err, doc) {
            if (err) {
                console.log(err);
            }
            else if (doc) {
                var newLinkList = doc.links;
                for (j = 0; j < list.length; j++) {
                    if (j != i) {
                        if (list[j].name != doc.name) {
                            var newLink = {
                                filename: list[j].name
                                , percentage: '60%'
                            };
                            newLinkList.push(newLink);
                        }
                    }
                }
                var noDuplicates = new Set(newLinkList);
                doc.links = Array.from(noDuplicates);
                console.log("New links pushed to doc");
                doc.save();
                if (i + 1 < list.length) {
                    createLink(list, user, ++i);
                }
            }
        });
    }
}

apiRoutes.post('/updatelastopened', function (req, res) {
    var user = req.headers['user'];
    var filename = req.headers['filename'];
    File.findOne({
        user: user
        , filename: filename
    }, function (err, doc) {
        if (err) {
            console.log(err);
            res.status(409).end();
        }
        else if (doc) {
            doc.lastOpened = Date.now();
            doc.save();
            res.status(200).end();
        }
    });
});

app.use('/api', apiRoutes);
// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Magic happens at http://localhost:' + port);
createFilesDir();