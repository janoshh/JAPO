var jq = $.noConflict();
var app = angular.module('Japo-app', ['ngRoute']);
app.config(function ($routeProvider) {
    $routeProvider.when("/", {
        templateUrl: "login.html"
    }).when("/registered", {
        templateUrl: "registered.html"
    }).when("/home/", {
        templateUrl: "home.html"
    }).when("/upload", {
        templateUrl: "form.html"
    }).when("/login", {
        templateUrl: "login.html"
    }).when("/accountdeleted", {
        templateUrl: "accountdeleted.html"
    }).when("/show", {
        templateUrl: "show.html"
    })
});
// -----------------
// Log In Controller
// -----------------
app.controller("logInController", function ($scope, $http, $location) {
    $scope.button = "btn btn-lg btn-primary btn-block disabled"
    $scope.$watch('email', function () {
        $scope.validate()
    });
    $scope.$watch('password', function () {
        $scope.validate()
    });
    $scope.validate = function () {
        if ($scope.email != null && $scope.password != null) {
            $scope.button = "btn btn-lg btn-primary btn-block"
        } else {
            $scope.button = "btn btn-lg btn-primary btn-block disabled"
        }
    };
    $scope.LogIn = function () {
        //gegevens ophalen login
        var emailUser = $scope.email;
        var loginPass = $scope.password;
        //post req
        $http.post("/api/authenticate", {
            "name": emailUser,
            "password": loginPass
        }).success(function (post) {
            sessionStorage.setItem('japo-token', post.token);
            sessionStorage.setItem('username', emailUser);
            $location.path("/home/");
        });
    }
});
// -------------------
// Register Controller
// -------------------
app.controller("registerController", function ($scope, $http, $location) {
    $scope.$watch('password', function (newValue) {
        if ($scope.password != null) {
            if ($scope.password.length < 6) {
                $scope.passLength = "registrationFormAlert help-block";
            } else {
                $scope.passLength = "display-none";
            }
            $scope.validate();
        }
    });
    $scope.$watch('confirmPassword', function (newValue, oldValue) {
        if ($scope.confirmPassword === "" || $scope.confirmPassword == null) {
            $scope.icon = "form-control-feedback"
        } else {
            if ($scope.password === $scope.confirmPassword) {
                $scope.icon = "glyphicon glyphicon-ok form-control-feedback";
            } else {
                $scope.icon = "glyphicon glyphicon-remove form-control-feedback";
            }
            $scope.validate();
        }
    });
    $scope.$watch('fname', function () {
        $scope.validate()
    });
    $scope.$watch('lname', function () {
        $scope.validate()
    });
    $scope.$watch('email', function () {
        $scope.validate()
    });
    $scope.button = "btn btn-lg btn-primary btn-block disabled"
    $scope.validate = function () {
        if ($scope.fname != null && $scope.lname != null && $scope.email != null && $scope.password != null && $scope.password === $scope.confirmPassword) {
            $scope.button = "btn btn-lg btn-primary btn-block"
        } else {
            $scope.button = "btn btn-lg btn-primary btn-block disabled"
        }
    }
    $scope.Register = function () {
        //gegevens ophalen register
        var fname = $scope.fname;
        var lname = $scope.lname;
        var email = $scope.email;
        var password = $scope.password;
        var confirmPassword = $scope.confirmPassword;
        //post req
        if ($scope.password === $scope.confirmPassword) {
            $http.post("/api/createUser", {
                "fname": fname,
                "lname": lname,
                "email": email,
                "password": password
            }).success(function (post) {
                $location.path("/registered");
            });
        }
    }
});
// ---------------
// Home Controller
// ---------------
app.controller("homeController", function ($scope, $http, $location, fileService) {
    // Show List or Grid
    $scope.documentsMessage = "Loading documents...";
    jq('#collectionsList').hide();
    $scope.grid = function () {
        jq('#collection').show();
        jq('#collectionsList').hide();
    }
    $scope.table = function () {
        jq('#collection').hide();
        jq('#collectionsList').show();
    }
    $scope.nsName = true;
    $scope.nsTag = true;
    $scope.nsDate = true;
    var token = sessionStorage.getItem("japo-token");
    var user = sessionStorage.getItem("username");
    $scope.user = user;
    var fileList;
    $scope.fileList = [];
    $http({
        method: 'GET',
        url: '/api/getFiles',
        headers: {
            'x-access-token': token,
            'user': user
        }
    }).then(function (response) {
        fileList = response.data.files[0];
        for (i = 0; i < fileList.length; i++) {
            var name = fileList[i].filename;
            var customfilename = fileList[i].customfilename;
            if (customfilename === "undefined") {
                customfilename = name
            }
            if (customfilename.lastIndexOf('.') > 0) {
                customfilename = customfilename.substring(0, customfilename.lastIndexOf('.'));
            }
            if (customfilename.length > 25) {
                customfilename = customfilename.substring(0, 25) + "...";
            }
            var size = humanFileSize(fileList[i].size, true);
            var date = fileList[i].date;
            date = date.substring(0, date.indexOf('T'));
            var tags = fileList[i].tags;
            if (tags === "undefined") {
                tags = "";
            }
            var location = fileList[i].location;
            var filetype = fileList[i].filetype.toUpperCase();
            if (filetype === 'PDF') {
                var thumbnail = "https://s3.amazonaws.com/" + user.replace("@", "-") + "/pdflogo.png";
            } else {
                var thumbnail = "https://s3.amazonaws.com/" + user.replace("@", "-") + "/thumb_" + name;
            }
            var file = {
                name, customfilename, size, thumbnail, date, tags, location, filetype
            };
            $scope.fileList.push(file);
        }
        if ($scope.fileList.length > 0) {
            $scope.documentsMessage = "";
        } else {
            $scope.documentsMessage = "You have not yet uploaded any documents.";
        }
    });
    $scope.goToUpload = function () {
        $location.path("/upload");
    }
    $scope.logOut = function () {
        $location.path("/login");
    }
    $scope.showFile = function (loc) {
        globalLoc = loc;
        $location.path("/show");
    }
    $scope.deleteAccount = function () {
        bootbox.confirm({
            title: "Delete account?",
            message: "You are about to delete your account. This will delete all files and cannot be undone. Are you sure?",
            buttons: {
                cancel: {
                    label: '<i class="glyphicon glyphicon-remove"></i> Cancel'
                },
                confirm: {
                    label: '<i class="glyphicon glyphicon-ok"></i> Confirm'
                }
            },
            callback: function (result) {
                if (result) {
                    var xhr = new XMLHttpRequest()
                    xhr.open("POST", "/api/deleteaccount");
                    xhr.setRequestHeader("x-access-token", token);
                    xhr.setRequestHeader("user", user);
                    xhr.send()
                    $location.path("/login");
                }
            }
        });
        $location.path("/accountdeleted");
    }
    $scope.deleteAllFiles = function () {
        bootbox.confirm({
            title: "Delete all files?",
            message: "You are about to delete all your files. Are you sure?",
            buttons: {
                cancel: {
                    label: '<i class="glyphicon glyphicon-remove"></i> Cancel'
                },
                confirm: {
                    label: '<i class="glyphicon glyphicon-ok"></i> Confirm'
                }
            },
            callback: function (result) {
                if (result) {
                    var xhr = new XMLHttpRequest()
                    xhr.open("POST", "/api/deleteallfiles");
                    xhr.setRequestHeader("x-access-token", token);
                    xhr.setRequestHeader("user", user);
                    xhr.send()
                }
            }
        });
    }
    $scope.deleteFile = function (filename) {
        bootbox.confirm({
            title: "Delete " + filename + "?",
            message: "You are about to delete " + filename + ". Are you sure?",
            buttons: {
                cancel: {
                    label: '<i class="glyphicon glyphicon-remove"></i> Cancel'
                },
                confirm: {
                    label: '<i class="glyphicon glyphicon-ok"></i> Confirm'
                }
            },
            callback: function (result) {
                if (result) {
                    var xhr = new XMLHttpRequest()
                    xhr.open("POST", "/api/deletefile");
                    xhr.setRequestHeader("x-access-token", token);
                    xhr.setRequestHeader("user", user);
                    xhr.setRequestHeader("filename", filename);
                    xhr.send()
                }
            }
        });
    };
    $scope.showFile = function (file) {
        fileService.saveFile(file);
        $location.path("/show");
        /*
        window.open('/getfile?file=' + name + '&user=' + user, '_blank')
        $http({
            method: 'GET'
            , url: '/api/getfile?file=' + name + '&user=' + user
            , headers: {
                'x-access-token': token
                , 'filesize': size
            }
        }).then(function (response) {
            console.log(response);
        });
        */
    }

    $scope.searchChange = function () {
        text = $scope.search;
        var customNameList = [];
        var tagList = [];
        var dateList = [];
        if (text != "") { // || text != null || $scope.fileList != null
            $scope.nsName = false;
            $scope.nsTag = false;
            $scope.nsDate = false;
            for (i = 0; i < $scope.fileList.length; i++) {
                if ($scope.fileList[i].customfilename.toLowerCase().indexOf(text.toLowerCase()) > -1) {
                    customNameList.push($scope.fileList[i]);
                }
                if ($scope.fileList[i].tags.toLowerCase().indexOf(text.toLowerCase()) > -1) {
                    tagList.push($scope.fileList[i]);
                }
                if ($scope.fileList[i].date.toLowerCase().indexOf(text.toLowerCase()) > -1) {
                    dateList.push($scope.fileList[i]);
                }
            }

            $scope.sortedNameList = customNameList;
            $scope.sortedTagList = tagList;
            $scope.sortedDateList = dateList;

            if (customNameList == null || customNameList == "") {
                $scope.nsName = true;
            }
            if (tagList == null || tagList == "") {
                $scope.nsTag = true;
            }
            if (dateList == null || dateList == "") {
                $scope.nsDate = true;
            }
            
        } else {
            $scope.nsName = true;
            $scope.nsTag = true;
            $scope.nsDate = true;
        }
    }
});

// -----------------
// Upload Controller
// -----------------
app.controller("uploadController", function ($scope, $http, $location) {
    //============== DRAG & DROP =============
    var dropbox = document.getElementById("dropbox")
        // init event handlers
    function dragEnterLeave(evt) {
        evt.stopPropagation()
        evt.preventDefault()
        $scope.$apply(function () {
            $scope.dropText = 'Drop files here...'
            $scope.dropClass = ''
        })
    }
    dropbox.addEventListener("dragenter", dragEnterLeave, false)
    dropbox.addEventListener("dragleave", dragEnterLeave, false)
    dropbox.addEventListener("dragover", function (evt) {
        evt.stopPropagation()
        evt.preventDefault()
        var clazz = 'not-available'
        var ok = evt.dataTransfer && evt.dataTransfer.types && evt.dataTransfer.types.indexOf('Files') >= 0
        $scope.$apply(function () {
            $scope.dropText = ok ? 'Drop files here...' : 'Only files are allowed!'
            $scope.dropClass = ok ? 'over' : 'not-available'
        })
    }, false)
    dropbox.addEventListener("drop", function (evt) {
            console.log('drop evt:', JSON.parse(JSON.stringify(evt.dataTransfer)))
            evt.stopPropagation()
            evt.preventDefault()
            $scope.$apply(function () {
                $scope.dropText = 'Drop files here...'
                $scope.dropClass = ''
            })
            var files = evt.dataTransfer.files
            if (files.length > 0) {
                $scope.$apply(function () {
                    $scope.files = []
                    for (var i = 0; i < files.length; i++) {
                        $scope.files.push(files[i])
                    }
                })
            }
        }, false)
        //============== DRAG & DROP =============
    $scope.setFiles = function (element) {
        $scope.$apply(function (scope) {
            console.log('files:', element.files);
            // Turn the FileList object into an Array
            $scope.files = []
            for (var i = 0; i < element.files.length; i++) {
                $scope.files.push(element.files[i])
            }
            $scope.progressVisible = false
        });
    };
    $scope.tags;
    $scope.customFilename;
    $scope.uploadFile = function () {
        var fd = new FormData()
        for (var i in $scope.files) {
            fd.append("uploadedFile", $scope.files[i])
        }
        var token = sessionStorage.getItem("japo-token");
        var user = sessionStorage.getItem("username");
        var xhr = new XMLHttpRequest()
        xhr.upload.addEventListener("progress", uploadProgress, false);
        xhr.addEventListener("load", uploadComplete, false);
        xhr.addEventListener("error", uploadFailed, false);
        xhr.addEventListener("abort", uploadCanceled, false);
        xhr.open("POST", "/api/upload");
        xhr.setRequestHeader("x-access-token", token);
        xhr.setRequestHeader("user", user);
        xhr.setRequestHeader("file-size", $scope.files[i].size);
        xhr.setRequestHeader("tags", $scope.tags);
        xhr.setRequestHeader("customFilename", $scope.customFilename);
        $scope.progressVisible = true
        xhr.send(fd)
    }

    function uploadProgress(evt) {
        $scope.$apply(function () {
            if (evt.lengthComputable) {
                $scope.progress = Math.round(evt.loaded * 100 / evt.total)
            } else {
                $scope.progress = 'unable to compute'
            }
        })
    }

    function uploadComplete(evt) {
        /* This event is raised when the server send back a response */
        //alert(evt.target.responseText)
        //$location.path("/home");
    }

    function uploadFailed(evt) {
        //alert("There was an error attempting to upload the file.")
    }

    function uploadCanceled(evt) {
        $scope.$apply(function () {
                $scope.progressVisible = false
            })
            //alert("The upload has been canceled by the user or the browser dropped the connection.")
    }
    $scope.goBack = function () {
        $location.path("/home");
    }
});
//----------------------
//show controller
//----------------------
app.controller("show", function ($scope, $http, $location, fileService) {
    $scope.goBack = function () {
        $location.path("/home");
    }

    $scope.file = fileService.getFile();
    var url = "http://localhost:8080/getfile?file=" + $scope.file.name + "&user=test@account.com";
    var pdfDoc = null,
        pageNum = 1,
        pageRendering = false,
        pageNumPending = null,
        scale = 0.8,
        canvas = document.getElementById('the-canvas'),
        ctx = canvas.getContext('2d');
    /**
     * Get page info from document, resize canvas accordingly, and render page.
     * @param num Page number.
     */
    function renderPage(num) {
        pageRendering = true;
        // Using promise to fetch the page
        pdfDoc.getPage(num).then(function (page) {
            var viewport = page.getViewport(scale);
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            // Render PDF page into canvas context
            var renderContext = {
                canvasContext: ctx,
                viewport: viewport
            };
            var renderTask = page.render(renderContext);
            // Wait for rendering to finish
            renderTask.promise.then(function () {
                pageRendering = false;
                if (pageNumPending !== null) {
                    // New page rendering is pending
                    renderPage(pageNumPending);
                    pageNumPending = null;
                }
            });
        });
        // Update page counters
        document.getElementById('page_num').textContent = pageNum;
    }
    /**
     * If another page rendering in progress, waits until the rendering is
     * finised. Otherwise, executes rendering immediately.
     */
    function queueRenderPage(num) {
        if (pageRendering) {
            pageNumPending = num;
        } else {
            renderPage(num);
        }
    }
    /**
     * Displays previous page.
     */
    function onPrevPage() {
        if (pageNum <= 1) {
            return;
        }
        pageNum--;
        queueRenderPage(pageNum);
    }
    document.getElementById('prev').addEventListener('click', onPrevPage);
    /**
     * Displays next page.
     */
    function onNextPage() {
        if (pageNum >= pdfDoc.numPages) {
            return;
        }
        pageNum++;
        queueRenderPage(pageNum);
    }
    document.getElementById('next').addEventListener('click', onNextPage);
    /**
     * Asynchronously downloads PDF.
     */
    PDFJS.getDocument(url).then(function (pdfDoc_) {
        pdfDoc = pdfDoc_;
        document.getElementById('page_count').textContent = pdfDoc.numPages;
        // Initial/first page rendering
        renderPage(pageNum);
    });

    /* -------------------------------
    text extracten uit pdf voor search
    ---------------------------------*/
    //functie uitvoeren als pdf geladen is nog implementeren ..
    this.pdfToText = function (data, callbackPageDone, callbackAllDone) {

        console.assert(url instanceof ArrayBuffer || typeof url == 'string');

        PDFJS.getDocument(url).then(function (pdf) {
            var full_text = "";
            var total = pdf.numPages;
            callbackPageDone(0, total);
            var layers = {};
            for (i = 1; i <= total; i++) {
                pdf.getPage(i).then(function (page) {
                    var n = page.pageNumber;
                    page.getTextContent().then(function (textContent) {
                        if (null != textContent.items) {

                            var page_text = "";
                            var last_block = null;

                            for (var k = 0; k < textContent.items.length; k++) {
                                var block = textContent.items[k];
                                if (last_block != null && last_block.str[last_block.str.length - 1] != ' ') {
                                    if (block.x < last_block.x)
                                        page_text += "\r\n";
                                    else if (last_block.y != block.y && (last_block.str.match(/^(\s?[a-zA-Z])$|^(.+\s[a-zA-Z])$/) == null))
                                        page_text += ' ';
                                }
                                page_text += block.str;
                                last_block = block;
                            }

                            textContent != null && console.log("page " + n + " finished."); //" content: \n" + page_text);
                            layers[n] = page_text + "\n\n";
                        }
                        ++self.complete;
                        callbackPageDone(self.complete, total);
                        if (self.complete == total) {
                            window.setTimeout(function () {

                                var num_pages = Object.keys(layers).length;
                                for (var j = 1; j <= num_pages; j++)
                                    full_text += layers[j];
                                callbackAllDone(full_text);
                                console.log(full_text);
                            }, 1000);
                        }
                    }); // end  of page.getTextContent().then
                }); // end of page.then
            } // of for
        });
    }; // end of pdfToText()

    //zoeken in full_text  string en krijgt plaatsnummer terug
    $scope.searchPDF = function () {
        var result = full_text.search(document.getElementById('searchBox').value);
    }

});
//
//
app.service('fileService', function () {
    var file;
    var saveFile = function (newFile) {
        file = newFile;
    };
    var getFile = function () {
        return file;
    };
    return {
        saveFile: saveFile,
        getFile: getFile
    };
});
//
//
// Size van Bytes naar kb, mb, gb,... omzetten
function humanFileSize(bytes, si) {
    var thresh = si ? 1000 : 1024;
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = si ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
}
