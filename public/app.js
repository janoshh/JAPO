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
        }
        else {
            $scope.button = "btn btn-lg btn-primary btn-block disabled"
        }
    };
    $scope.LogIn = function () {
        //gegevens ophalen login
        var emailUser = $scope.email;
        var loginPass = $scope.password;
        //post req
        $http.post("/api/authenticate", {
            "name": emailUser
            , "password": loginPass
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
            }
            else {
                $scope.passLength = "display-none";
            }
            $scope.validate();
        }
    });
    $scope.$watch('confirmPassword', function (newValue, oldValue) {
        if ($scope.confirmPassword === "" || $scope.confirmPassword == null) {
            $scope.icon = "form-control-feedback"
        }
        else {
            if ($scope.password === $scope.confirmPassword) {
                $scope.icon = "glyphicon glyphicon-ok form-control-feedback";
            }
            else {
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
        }
        else {
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
                "fname": fname
                , "lname": lname
                , "email": email
                , "password": password
            }).success(function (post) {
                sessionStorage.setItem('japo-token', post.token);
                sessionStorage.setItem('username', email);
                $location.path("/home/");
            });
        }
    }
});
// ---------------
// Home Controller
// ---------------
app.controller("homeController", function ($scope, $http, $location, fileService) {
    
    if (sessionStorage.getItem('username') === "") {
        $location.path("/login");
    }
    
    // Show List or Grid
    $scope.documentsMessage = "Loading documents...";
    $scope.searching = false;
    $scope.editingFile = "";
    jq('#collectionsList').hide();
    $scope.grid = function () {
        jq('#collection').show();
        jq('#collectionsList').hide();
        sessionStorage.setItem('listOrGrid', "grid");
    }
    $scope.list = function () {
        jq('#collection').hide();
        jq('#collectionsList').show();
        sessionStorage.setItem('listOrGrid', "list");
    }
    $scope.nsName = true;
    $scope.nsTag = true;
    $scope.nsDate = true;
    $scope.nsContent = true;
    var token = sessionStorage.getItem("japo-token");
    var user = sessionStorage.getItem("username");
    var listOrGrid = sessionStorage.getItem("listOrGrid");
    if (listOrGrid === "grid") {
        $scope.grid();
    }
    else {
        $scope.list();
    }
    $scope.user = user;
    var fileList;
    $scope.fileList = [];
    $scope.capacityUsed = 0;

    function getFiles() {
        $scope.capacityUsed = 0;
        $http({
            method: 'GET'
            , url: '/api/getFiles'
            , headers: {
                'x-access-token': token
                , 'user': user
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
                if (customfilename.length > 15) {
                    customfilename = customfilename.substring(0, 15) + "...";
                }
                var humansize = humanFileSize(fileList[i].size, true);
                var size = parseInt(fileList[i].size);
                // Count all file sizes together
                $scope.capacityUsed += parseInt(fileList[i].size);
                var date = fileList[i].date;
                date = date.substring(0, date.indexOf('T'));
                var tags = fileList[i].tags;
                if (tags === "undefined") {
                    tags = "";
                }
                var location = fileList[i].location;
                var filetype = fileList[i].filetype.toUpperCase();
                if (filetype === 'PDF') {
                    var thumbnail = "https://s3.amazonaws.com/" + user.replace("@", "-") + "/thumb_" + name + ".jpg";
                }
                else {
                    var thumbnail = "https://s3.amazonaws.com/" + user.replace("@", "-") + "/thumb_" + name;
                }
                var content = fileList[i].content;
                var links = fileList[i].links;
                var file = {
                    name, customfilename, size, humansize, thumbnail, date, tags, location, filetype, content, links
                };
                $scope.fileList.push(file);
            }
            fileService.saveFileList($scope.fileList);
            if ($scope.fileList.length > 0) {
                $scope.documentsMessage = "";
            }
            else {
                $scope.documentsMessage = "You have not yet uploaded any documents.";
            }
            $scope.capacityUsed = humanFileSize($scope.capacityUsed, true);
            if ($scope.capacityUsed.match('kB')) {
                $scope.capacityUsed = $scope.capacityUsed.replace(/[^\d.-]/g, '') / 100;
            }
            else {
                $scope.capacityUsed = $scope.capacityUsed.replace(/[^\d.-]/g, '');
            }
            if ($scope.capacityUsed > 85) {
                $scope.capacityBlueUsed = 85;
                $scope.capacityRedUsed = $scope.capacityUsed - 85;
            }
            else {
                $scope.capacityBlueUsed = $scope.capacityUsed;
            }
            maxCapacity = 100
        });
    }

    function containsObject(obj, list) {
        for (i = 0; i < list.length; i++) {
            if (list[i].name === obj.name) {
                return true;
            }
        }
        return false;
    }
    $scope.propertyName = 'customfilename';
    $scope.reverse = true;
    $scope.sortBy = function (propertyName) {
        $scope.reverse = ($scope.propertyName === propertyName) ? !$scope.reverse : false;
        $scope.propertyName = propertyName;
    };
    getFiles();
    $scope.goToUpload = function () {
        $location.path("/upload");
    }
    $scope.logOut = function () {
        sessionStorage.setItem('japo-token', "");
        sessionStorage.setItem('username', "");
        $location.path("/login");
    }
    $scope.editFile = function (file) {
        var title = file.name;
        jq("#editCustomFilename").attr("value", file.customfilename);
        jq("#editTags").attr("value", file.tags);
        var modal = bootbox.dialog({
            message: jq(".form-content").html()
            , title: title
            , buttons: [
                {
                    label: "Save"
                    , className: "btn btn-primary pull-left"
                    , callback: function () {
                        var form = modal.find(".form");
                        var items = form.serializeJSON();
                        var xhr = new XMLHttpRequest()
                        xhr.open("POST", "/api/updatefile");
                        xhr.setRequestHeader("x-access-token", token);
                        xhr.setRequestHeader("user", user);
                        xhr.setRequestHeader("filename", file.name);
                        xhr.setRequestHeader("customfilename", items.editCustomFilename);
                        xhr.setRequestHeader("tags", items.editTags);
                        xhr.onload = function () {
                            if (xhr.status === 200) {
                                location.reload();
                            }
                        }
                        xhr.send();
                        /* This part you have to complete yourself :D
                        if (your_form_validation(items)) {
                          // Make your data save as async and then just call modal.modal("hide");
                        } else {
                          // Show some errors, etc on form
                        }
                        */
                        modal.modal("hide");
                        return false;
                    }
          }
                , {
                    label: "Close"
                    , className: "btn btn-default pull-left"
                    , callback: function () {}
          }
        ]
            , show: false
            , onEscape: function () {
                modal.modal("hide");
            }
        });
        modal.modal("show");
    }
    jQuery.fn.serializeJSON = function () {
        var json = {};
        jQuery.map(jQuery(this).serializeArray(), function (n) {
            var _ = n.name.indexOf('[');
            if (_ > -1) {
                var o = json
                    , _name;
                _name = n.name.replace(/\]/gi, '').split('[');
                for (var i = 0, len = _name.length; i < len; i++) {
                    if (i == len - 1) {
                        if (o[_name[i]]) {
                            if (typeof o[_name[i]] == 'string') {
                                o[_name[i]] = [o[_name[i]]];
                            }
                            o[_name[i]].push(n.value);
                        }
                        else {
                            o[_name[i]] = n.value || '';
                        }
                    }
                    else {
                        o = o[_name[i]] = o[_name[i]] || {};
                    }
                }
            }
            else if (json[n.name] !== undefined) {
                if (!json[n.name].push) {
                    json[n.name] = [json[n.name]];
                }
                json[n.name].push(n.value || '');
            }
            else {
                json[n.name] = n.value || '';
            }
        });
        return json;
    };
    $scope.deleteAccount = function () {
        bootbox.confirm({
            title: "Delete account?"
            , message: "You are about to delete your account. This will delete all files and cannot be undone. Are you sure?"
            , buttons: {
                cancel: {
                    label: '<i class="glyphicon glyphicon-remove"></i> Cancel'
                }
                , confirm: {
                    label: '<i class="glyphicon glyphicon-ok"></i> Confirm'
                }
            }
            , callback: function (result) {
                if (result) {
                    var xhr = new XMLHttpRequest()
                    xhr.open("POST", "/api/deleteaccount");
                    xhr.setRequestHeader("x-access-token", token);
                    xhr.setRequestHeader("user", user);
                    xhr.onload = function () {
                        if (xhr.status === 200) {
                            $location.path("/accountdeleted");
                            $scope.$apply();
                        }
                    }
                    xhr.send()
                }
            }
        });
    }
    $scope.deleteAllFiles = function () {
        bootbox.confirm({
            title: "Delete all files?"
            , message: "You are about to delete all your files. Are you sure?"
            , buttons: {
                cancel: {
                    label: '<i class="glyphicon glyphicon-remove"></i> Cancel'
                }
                , confirm: {
                    label: '<i class="glyphicon glyphicon-ok"></i> Confirm'
                }
            }
            , callback: function (result) {
                if (result) {
                    var xhr = new XMLHttpRequest()
                    xhr.open("POST", "/api/deleteallfiles");
                    xhr.setRequestHeader("x-access-token", token);
                    xhr.setRequestHeader("user", user);
                    xhr.onload = function () {
                        if (xhr.status === 200) {
                            $location.path("/home");
                            $scope.$apply();
                        }
                    }
                    xhr.send()
                }
            }
        });
    }
    $scope.deleteFile = function (filename) {
        bootbox.confirm({
            title: "Delete " + filename + "?"
            , message: "You are about to delete " + filename + ". Are you sure?"
            , buttons: {
                cancel: {
                    label: '<i class="glyphicon glyphicon-remove"></i> Cancel'
                }
                , confirm: {
                    label: '<i class="glyphicon glyphicon-ok"></i> Confirm'
                }
            }
            , callback: function (result) {
                if (result) {
                    var xhr = new XMLHttpRequest()
                    xhr.open("POST", "/api/deletefile");
                    xhr.setRequestHeader("x-access-token", token);
                    xhr.setRequestHeader("user", user);
                    xhr.setRequestHeader("filename", filename);
                    xhr.onload = function () {
                        if (xhr.status === 200) {
                            $location.path("/home");
                            $scope.$apply();
                        }
                    }
                    xhr.send()
                }
            }
        });
    };
    $scope.showFile = function (file) {
        fileService.saveFile(file);
        $location.path("/show");
    }
    $scope.downloadFile = function (file) {
        var title = file.name;
        $http({
            method: 'GET'
            , url: '/getfile?file=' + file.name + '&user=' + user
        }).success(function (data, status, headers, config) {
            // TODO when WS success
            var file = new Blob([data], {
                type: 'application/csv'
            });
            //trick to download a file having its URL
            var fileURL = URL.createObjectURL(file);
            var a = document.createElement('a');
            a.href = fileURL;
            a.target = '_blank';
            a.download = title;
            document.body.appendChild(a);
            a.click();
        }).error(function (data, status, headers, config) {});
    }
    $scope.searchChange = function () {
        text = $scope.search;
        var customNameList = [];
        var tagList = [];
        var dateList = [];
        var contentList = [];
        if (text != "") { // || text != null || $scope.fileList != null
            $scope.searching = true;
            console.log($scope.searching);
            $scope.nsName = false;
            $scope.nsTag = false;
            $scope.nsDate = false;
            $scope.nsContent = false;
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
                if ($scope.fileList[i].content.toLowerCase().indexOf(text.toLowerCase()) > -1) {
                    contentList.push($scope.fileList[i]);
                }
            }
            $scope.sortedNameList = customNameList;
            $scope.sortedTagList = tagList;
            $scope.sortedDateList = dateList;
            $scope.sortedContentList = contentList;
            if (customNameList == null || customNameList == "") {
                $scope.nsName = true;
            }
            if (tagList == null || tagList == "") {
                $scope.nsTag = true;
            }
            if (dateList == null || dateList == "") {
                $scope.nsDate = true;
            }
            if (contentList == null || contentList == "") {
                $scope.nsContent = true;
            }
            if ($scope.nsName && $scope.nsTag && $scope.nsDate && $scope.nsContent) {
                $scope.documentsMessage = "No search results.";
            }
            else {
                $scope.documentsMessage = "";
            }
        }
        else {
            $scope.searching = false;
            console.log($scope.searching);
            $scope.nsName = true;
            $scope.nsTag = true;
            $scope.nsDate = true;
            $scope.nsContent = true;
        }
    }
});
// -----------------
// Upload Controller
// -----------------
app.controller("uploadController", function ($scope, $http, $location) {
    jq("#filesection").show();
    jq('#notEnoughSpace').hide();
    jq("#processinggif").hide();
    jq("#uploadError").hide();
    $scope.currentAction = "";
    $scope.largeFile = false;
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
            // Turn the FileList object into an Array
            $scope.files = []
            for (var i = 0; i < element.files.length; i++) {
                $scope.files.push(element.files[i])
            }
            $scope.progressVisible = false
        });
    };
    $scope.updateFile = function () {
        jq("#uploadError").hide();
    }
    $scope.tags;
    $scope.customFilename;
    $scope.uploadFile = function () {
        var fd = new FormData()
        for (var i in $scope.files) {
            fd.append("uploadedFile", $scope.files[i]);
        }
        var fileType = $scope.files[0].name.substring($scope.files[0].name.lastIndexOf('.') + 1).toLowerCase();
        if (["pdf", "jpg", "jpeg", "png"].indexOf(fileType) > -1) {
            if ((($scope.files[0].size / 1024) / 1024) > 3) {
                $scope.largeFile = true;
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
            xhr.onload = function () {
                if (xhr.status === 200) {
                    if (fileType === "pdf") {
                        $scope.currentAction = "Processing PDF...";
                        $scope.safeApply();
                        showPdf($scope.files[0].name);
                    }
                    else {
                        /*file = $scope.files[0];
                        Tesseract.recognize(file).then(function (result) {
                                var text = result.text;
                            });
                            */
                        $location.path("/home");
                        $scope.$apply();
                    }
                }
                if (xhr.status === 409) {
                    jq("#processinggif").hide();
                    jq('#notEnoughSpace').show();
                }
            };
            xhr.send(fd)
            $scope.currentAction = "Uploading...";
            $scope.safeApply();
        }
        else {
            jq("#uploadError").show();
        }
    }

    function uploadProgress(evt) {
        $scope.$apply(function () {
            if (evt.lengthComputable) {
                $scope.progress = Math.round(evt.loaded * 100 / evt.total)
            }
            else {
                $scope.progress = 'unable to compute'
            }
            jq("#processinggif").show();
            jq("#filesection").hide();
        })
    }
    //_____________________________________________________________
    function showPdf(fname) {
        var user = sessionStorage.getItem("username");
        var url = "/getfile?file=" + fname + "&user=" + user;
        var pdfDoc = null
            , pageNum = 1
            , pageRendering = false
            , pageNumPending = null
            , scale = 1
            , canvas = document.getElementById('the-canvas')
            , ctx = canvas.getContext('2d');

        function renderPage(num) {
            pageRendering = true;
            // Using promise to fetch the page
            pdfDoc.getPage(num).then(function (page) {
                var viewport = page.getViewport(scale);
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                // Render PDF page into canvas context
                var renderContext = {
                    canvasContext: ctx
                    , viewport: viewport
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
                    // GET TEXT OUT OF PDF
                    // -------------------
                    pdfToText(pdfDoc, function (text) {
                        $scope.currentAction = "Analyzing text in PDF...";
                        $scope.safeApply();
                        var xhr = new XMLHttpRequest();
                        xhr.open("POST", "/pdftext");
                        xhr.setRequestHeader("user", user);
                        xhr.setRequestHeader("filename", fname);
                        xhr.onload = function () {
                            if (xhr.status === 200) {
                                pdfthumbnail();
                            }
                        };
                        xhr.send(text);
                    });
                    //
                    function pdfthumbnail() {
                        $scope.currentAction = "Creating thumbnail...";
                        $scope.safeApply();
                        var canvas = document.getElementById("the-canvas");
                        var img = canvas.toDataURL("image/png");
                        var user = sessionStorage.getItem("username");
                        var xhr = new XMLHttpRequest();
                        xhr.open("POST", "/pdfthumbnail");
                        xhr.setRequestHeader("user", user);
                        xhr.setRequestHeader("filename", fname);
                        xhr.onload = function () {
                            if (xhr.status === 200) {
                                $location.path("/home");
                                $scope.$apply();
                            }
                        };
                        xhr.send(img);
                    }
                });
            });
        }

        function queueRenderPage(num) {
            if (pageRendering) {
                pageNumPending = num;
            }
            else {
                renderPage(num);
            }
        }
        PDFJS.getDocument(url).then(function (pdfDoc_) {
            pdfDoc = pdfDoc_;
            // Initial/first page rendering
            renderPage(pageNum);
        });

        function pdfToText(data, callbackAllDone) {
            complete = 0;
            console.assert(url instanceof ArrayBuffer || typeof url == 'string');
            PDFJS.getDocument(url).then(function (pdf) {
                var full_text = "";
                var total = pdf.numPages;
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
                                        if (block.x < last_block.x) page_text += "\r\n";
                                        else if (last_block.y != block.y && (last_block.str.match(/^(\s?[a-zA-Z])$|^(.+\s[a-zA-Z])$/) == null)) page_text += ' ';
                                    }
                                    page_text += block.str;
                                    last_block = block;
                                }
                                //textContent != null && console.log("page " + n + " finished."); //" content: \n" + page_text);
                                layers[n] = page_text + "\n\n";
                            }
                            ++complete;
                            if (complete == total) {
                                window.setTimeout(function () {
                                    var num_pages = Object.keys(layers).length;
                                    for (var j = 1; j <= num_pages; j++) full_text += layers[j];
                                    callbackAllDone(full_text);
                                }, 1000);
                            }
                        }); // end  of page.getTextContent().then
                    }); // end of page.then
                } // of for
            });
        }; // end of pdfToText()
    }
    //_____________________________________________________________
    function uploadComplete(evt) {}

    function uploadFailed(evt) {}

    function uploadCanceled(evt) {
        $scope.$apply(function () {
                $scope.progressVisible = false
            })
            //alert("The upload has been canceled by the user or the browser dropped the connection.")
    }
    $scope.goToHome = function () {
        $location.path("/home");
    }
    $scope.safeApply = function (fn) {
        var phase = this.$root.$$phase;
        if (phase == '$apply' || phase == '$digest') {
            if (fn && (typeof (fn) === 'function')) {
                fn();
            }
        }
        else {
            this.$apply(fn);
        }
    };
});
//----------------------
//show controller
//----------------------
app.controller("show", function ($scope, $http, $location, fileService, $route) {
    jq("#loading").show();
    jq('#showSection').hide();
    jq('#imageSection').hide();
    var user = sessionStorage.getItem("username");
    //
    $scope.goToHome = function () {
        $location.path("/home");
    }
    $scope.file = fileService.getFile();
    $scope.fileList = fileService.getFileList();
    $scope.linksList = [];
    for (i = 0; i < $scope.fileList.length; i++) {
        for (j = 0; j < $scope.file.links.length; j++) {
            if ($scope.fileList[i].name === $scope.file.links[j]) {
                $scope.linksList.push($scope.fileList[i]);
            }
        }
    }
    $scope.showFile = function (file) {
            fileService.saveFile(file);
            $route.reload();
        }
        //
    if ($scope.file.filetype === "PDF") {
        showPdf();
    }
    else {
        var img = document.createElement("img");
        img.setAttribute("src", $scope.file.location);
        img.setAttribute("height", "100%");
        img.setAttribute("width", "auto");
        img.setAttribute("alt", $scope.file.customfilename);
        document.getElementById("imageSection").appendChild(img);
        jq("#loading").hide();
        jq('#imageSection').show();
    }

    function showPdf() {
        var url = "/getfile?file=" + $scope.file.name + "&user=" + user;
        pdfDoc = null, pageNum = 1, pageRendering = false, pageNumPending = null, scale = 1, canvas = document.getElementById('the-canvas'), ctx = canvas.getContext('2d');
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
                    canvasContext: ctx
                    , viewport: viewport
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
            }
            else {
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
            jq("#loading").hide();
            jq('#showSection').show();
        });
    }
});
//
//
app.service('fileService', function () {
    var file;
    var fileList;
    var saveFile = function (newFile) {
        file = newFile;
    };
    var getFile = function () {
        return file;
    };
    var saveFileList = function (newFileList) {
        fileList = newFileList;
    };
    var getFileList = function () {
        return fileList;
    };
    return {
        saveFile: saveFile
        , getFile: getFile
        , saveFileList: saveFileList
        , getFileList: getFileList
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