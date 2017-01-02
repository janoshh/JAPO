var jq = $.noConflict();
var app = angular.module('Japo-app', ["ngAnimate", "ngRoute"]);
//var app = angular.module('Japo-app', ["ngRoute"]);
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
    }).when("/show/:filename", {
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
        if ($scope.password === $scope.confirmPassword && $scope.password.length >= 6) {
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
app.controller("homeController", function ($scope, $http, $location, fileService, $interval) {
    if (sessionStorage.getItem('username') === "") {
        $location.path("/login");
    }
    // Show List or Grid
    $scope.documentsMessage = "Loading documents...";
    $scope.searching = false;
    $scope.editingFile = "";
    $scope.userSavedSuccess = false;
    $scope.premium = false;
    $scope.duplicatesFound = false;
    $scope.doNotShowDuplicatesPopup = sessionStorage.getItem("doNotShowDuplicatesPopup");
    if ($scope.doNotShowDuplicatesPopup === null) {
        $scope.doNotShowDuplicatesPopup = false;
    }
    jq('#collectionsList').hide();
    $scope.grid = false;
    $scope.grid = function () {
        jq('#collection').show();
        jq('#collectionsList').hide();
        jq('#btnToggleGridList').removeClass("glyphicon glyphicon-list");
        jq('#btnToggleGridList').addClass("glyphicon glyphicon-th");
        sessionStorage.setItem('listOrGrid', "grid");
    }
    $scope.list = function () {
        jq('#collection').hide();
        jq('#collectionsList').show();
        jq('#btnToggleGridList').removeClass("glyphicon glyphicon-th");
        jq('#btnToggleGridList').addClass("glyphicon glyphicon-list");
        sessionStorage.setItem('listOrGrid', "list");
    }
    $scope.toggleGridList = function () {
        if (sessionStorage.getItem('listOrGrid') === "list") {
            $scope.grid();
        }
        else {
            $scope.list();
        }
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
    var previousList = [];

    function arraysEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (a.length != b.length) return false;
        // If you don't care about the order of the elements inside
        // the array, you should sort both arrays here.
        for (var i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function getFileList() {
        $http({
            method: 'GET'
            , url: '/api/getFiles'
            , headers: {
                'x-access-token': token
                , 'user': user
            }
        }).then(function (response) {
            //if (arraysEqual(response, previousList)) {
            //    console.log("Lijsten zijn't zelfde");
            //}
            //else {
            console.log("Nieuw gevonden");
            createCollection(response);
            //}
            previousList = response;
        });
    }
    var refreshFileList = $interval(function () {
        getFileList()
        console.log("REFRESHING");
    }, 5000);
    getFileList();

    function createCollection(response) {
        $scope.capacityUsed = 0;
        $scope.fileList.length = 0;
        $scope.premium = response.data.premium;
        fileList = response.data.files[0];
        for (i = 0; i < fileList.length; i++) {
            var name = fileList[i].filename;
            var customfilename = fileList[i].customfilename;
            if (customfilename === "undefined" || customfilename === "") {
                customfilename = name
            }
            customfilename = customfilename.substr(customfilename.indexOf("|") + 1, customfilename.length);
            if (customfilename.lastIndexOf('.') > 0) {
                customfilename = customfilename.substring(0, customfilename.lastIndexOf('.'));
            }
            if (customfilename.length > 15) {
                customfilename = customfilename.substr(0, 15) + "...";
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
            var thumbnail = "https://s3.amazonaws.com/" + user.replace("@", "-") + "/thumb_" + name;
            var content = fileList[i].content;
            var links = fileList[i].links;
            var file = {
                name, customfilename, size, humansize, thumbnail, date, tags, location, filetype, content, links
            };
            $scope.fileList.push(file);
        }
        $scope.duplicates = [];
        for (i = 0; i < $scope.fileList.length; i++) {
            for (j = 0; j < $scope.fileList[i].links.length; j++) {
                if ($scope.fileList[i].links[j].percentage > 90) {
                    var newDuplicate = {
                        file1: $scope.fileList[i].name
                        , file2: $scope.fileList[i].links[j].filename
                        , percentage: $scope.fileList[i].links[j].percentage
                    }
                    var alreadyInDuplicates = false;
                    for (l = 0; l < $scope.duplicates.length; l++) {
                        if (newDuplicate.file1 === $scope.duplicates[l].file2 && newDuplicate.file2 === $scope.duplicates[l].file1) {
                            alreadyInDuplicates = true;
                        }
                    }
                    if (!alreadyInDuplicates) {
                        $scope.duplicates.push(newDuplicate);
                    }
                }
            }
        }
        if ($scope.duplicates.length > 0) {
            $scope.duplicatesFound = true;
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
    $scope.goToUpload = function () {
        $location.path("/upload");
    }
    $scope.logOut = function () {
        sessionStorage.setItem('japo-token', "");
        sessionStorage.setItem('username', "");
        $location.path("/login");
    }
    $scope.doNotShowDumplicatePopup = function () {
        sessionStorage.setItem("doNotShowDuplicatesPopup", true);
    }
    $scope.findDuplicates = function () {
        if ($scope.duplicates.length > 0) {
            handleDuplicates($scope.duplicates);
        }
        else {
            bootbox.alert("We did not find any duplicates.");
        }
    }

    function handleDuplicates(duplicates) {
        var title = "We have found a possibly duplicate file."
        if ($scope.duplicates.length > 1) {
            title = "We have found " + duplicates.length + " possibly duplicate files."
        }
        var modal = bootbox.dialog({
            title: title
            , message: "You can take a look at them one by one or delete all duplicate files at once."
            , buttons: [
                {
                    label: '<i class="glyphicon glyphicon-file"></i> One by one'
                    , className: "btn btn-danger pull-left"
                    , callback: function () {
                        deleteDuplicatesOneByOne(duplicates, 0);
                    }
          }
                , {
                    label: '<i class="glyphicon glyphicon-duplicate"></i> All at once'
                    , className: "btn btn-danger pull-left"
                    , callback: function () {
                        deleteDuplicatesAllAtOnce(duplicates, 0);
                    }
            }
                                , {
                    label: "<span class='glyphicon glyphicon-ok'></span> Cancel "
                    , className: "btn btn-default pull-right"
                    , callback: function () {
                        modal.modal("hide");
                    }
                                }]
            , show: false
            , onEscape: function () {
                modal.modal("hide");
            }
        });
        modal.modal("show");
    }

    function deleteDuplicatesAllAtOnce(duplicates, i) {
        var xhr = new XMLHttpRequest()
        xhr.open("POST", "/api/deletefile");
        xhr.setRequestHeader("x-access-token", token);
        xhr.setRequestHeader("user", user);
        xhr.setRequestHeader("filename", duplicates[i].file1);
        xhr.onload = function () {
            if (xhr.status === 200) {
                if (i + 1 === duplicates.length) {
                    location.reload();
                }
                deleteDuplicatesAllAtOnce(duplicates, ++i);
            }
        }
        xhr.send()
    }

    function deleteDuplicatesOneByOne(duplicates, i) {
        if (i < $scope.duplicates.length) {
            var f1 = $scope.duplicates[i].file1.split("|")[1];
            var f2 = $scope.duplicates[i].file2.split("|")[1];
            var modal = bootbox.dialog({
                title: "Duplicate found"
                , message: '"' + f1 + '" is for ' + duplicates[i].percentage + '% the same as "' + f2 + '"'
                , buttons: [
                    {
                        label: "<span class='glyphicon glyphicon-remove'></span> Delete " + f1
                        , className: "btn btn-danger pull-left"
                        , callback: function () {
                            var xhr = new XMLHttpRequest()
                            xhr.open("POST", "/api/deletefile");
                            xhr.setRequestHeader("x-access-token", token);
                            xhr.setRequestHeader("user", user);
                            xhr.setRequestHeader("filename", duplicates[i].file1);
                            xhr.onload = function () {
                                if (xhr.status === 200) {
                                    modal.modal("hide");
                                    if (i + 1 === duplicates.length) {
                                        location.reload();
                                    }
                                    deleteDuplicatesOneByOne(duplicates, ++i);
                                }
                            }
                            xhr.send()
                            return false;
                        }
          }
                , {
                        label: "<span class='glyphicon glyphicon-remove'></span> Delete " + f2
                        , className: "btn btn-danger pull-left"
                        , callback: function () {
                            var xhr = new XMLHttpRequest()
                            xhr.open("POST", "/api/deletefile");
                            xhr.setRequestHeader("x-access-token", token);
                            xhr.setRequestHeader("user", user);
                            xhr.setRequestHeader("filename", duplicates[i].file2);
                            xhr.onload = function () {
                                if (xhr.status === 200) {
                                    modal.modal("hide");
                                    if (i + 1 === $scope.duplicates.length) {
                                        location.reload();
                                    }
                                    deleteDuplicatesOneByOne(duplicates, ++i);
                                }
                            }
                            xhr.send()
                            return false;
                        }
            }
                                , {
                        label: "<span class='glyphicon glyphicon-ok'></span>  Keep both"
                        , className: "btn btn-primary pull-right"
                        , callback: function () {
                            deleteDuplicatesOneByOne(duplicates, ++i);
                        }
                                }]
                , show: false
                , onEscape: function () {
                    modal.modal("hide");
                }
            });
            modal.modal("show");
        }
    }
    $scope.editUser = function () {
        var modal = bootbox.dialog({
            message: jq("#editUserForm").html()
            , title: "Settings " + sessionStorage.getItem('username')
            , buttons: [
                {
                    label: "<span class='glyphicon glyphicon-ok'></span> Save"
                    , className: "btn btn-primary pull-left"
                    , callback: function () {
                        var form = modal.find(".userForm");
                        var items = form.serializeJSON();
                        if ((items.newPassword.length >= 6) || (items.oldPassword.length === 0 && items.newPassword.length === 0 && items.confirmNewPassword.length === 0)) {
                            var xhr = new XMLHttpRequest()
                            xhr.open("POST", "/api/updateuser");
                            xhr.setRequestHeader("x-access-token", token);
                            xhr.setRequestHeader("user", user);
                            xhr.setRequestHeader("oldpassword", items.oldPassword);
                            xhr.setRequestHeader("newpassword", items.newPassword);
                            xhr.setRequestHeader("premium", items.premium);
                            xhr.onload = function () {
                                if (xhr.status === 200) {
                                    bootbox.alert("Settings saved succesfully.");
                                    modal.modal("hide");
                                }
                                if (xhr.status === 409) {
                                    bootbox.alert("The old password you entered, was incorrect.");
                                }
                            }
                            if (items.newPassword === items.confirmNewPassword) {
                                xhr.send();
                            }
                        }
                        else {
                            bootbox.alert("Please ensure that the new password contains six characters or more.");
                        }
                        return false;
                    }
          }
                , {
                    label: "<span class='glyphicon glyphicon-remove'></span> Close"
                    , className: "btn btn-default pull-left"
                    , callback: function () {}
          }, {
                    label: "<span class='glyphicon glyphicon-remove'></span>  Delete Account"
                    , className: "btn btn-danger pull-right"
                    , callback: function () {
                        $scope.deleteAccount();
                    }
          }
        ]
            , show: false
            , onEscape: function () {
                modal.modal("hide");
            }
        });
        modal.modal("show");
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
            title: "Delete " + filename.split("|")[1] + "?"
            , message: "You are about to delete " + filename.split("|")[1] + ". Are you sure?"
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
        $location.path("/show/" + file.name);
    }
    $scope.searchChange = function () {
        text = $scope.search;
        var customNameList = [];
        var tagList = [];
        var dateList = [];
        var contentList = [];
        if (text != "") { // || text != null || $scope.fileList != null
            $scope.searching = true;
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
    jq('#somethingWentWrong').hide();
    $scope.files = [];
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
            $scope.uploadFile();
        }, false)
        //============== DRAG & DROP =============
    $scope.setFiles = function (element) {
        $scope.$apply(function (scope) {
            // Turn the FileList object into an Array
            $scope.files = []
            var allFileTypesGood = true;
            for (var i = 0; i < element.files.length; i++) {
                $scope.files.push(element.files[i]);
                var fileType = $scope.files[i].name.substring($scope.files[i].name.lastIndexOf('.') + 1).toLowerCase();
                if (["pdf", "jpg", "jpeg", "png"].indexOf(fileType) < 0) {
                    allFileTypesGood = false;
                }
            }
            $scope.progressVisible = false
            if (allFileTypesGood) {
                $scope.uploadPopup();
            }
            else {
                $scope.files.length = 0;
                $scope.uploadFileTypeErrorPopup();
            }
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
            $scope.files[i].name = Date.now() + $scope.files[i];
            fd.append("uploadedFile", $scope.files[i]);
        }
        uploadNewFile(fd, 0);
    }

    $scope.uploadFromUrl = function () {            
            url = document.getElementById('url-input').value
            var token = sessionStorage.getItem("japo-token");
            var user = sessionStorage.getItem("username");
            var xhr = new XMLHttpRequest()
            xhr.upload.addEventListener("progress", uploadProgress, false);
            xhr.open("POST", "/api/upload");
            xhr.setRequestHeader("x-access-token", token);
            xhr.setRequestHeader("user", user);
            xhr.setRequestHeader("filename", "tempFilename");
            console.log(url);
            xhr.setRequestHeader("url", url);
            xhr.onload = function () {
                if (xhr.status === 500) {
                    bootbox.alert("Oops, sorry. Something went wrong while uploading your file.");
                }
                else if (xhr.status === 409) {
                    bootbox.alert("Oops, sorry. Your file could not be uploaded because you have reached your free storage limit.");
                }
                else if (xhr.status === 200) {
                    bootbox.alert("This actually worked");
                }
            };
            xhr.send();
        }
        
    function uploadNewFile(fd, i) {
        if (i < $scope.files.length) {
            var fileType = $scope.files[i].name.substring($scope.files[i].name.lastIndexOf('.') + 1).toLowerCase();
            if (["pdf", "jpg", "jpeg", "png"].indexOf(fileType) > -1) {
                var token = sessionStorage.getItem("japo-token");
                var user = sessionStorage.getItem("username");
                var xhr = new XMLHttpRequest()
                xhr.upload.addEventListener("progress", uploadProgress, false);
                xhr.open("POST", "/api/upload");
                xhr.setRequestHeader("x-access-token", token);
                xhr.setRequestHeader("user", user);
                $scope.progressVisible = true
                xhr.onreadystatechange = function () {
                    var status;
                    var data;
                    if (xhr.readyState == 4) {
                        status = xhr.status;
                        if (xhr.status === 500) {
                            bootbox.alert("Oops, sorry. Something went wrong while uploading your file.");
                        }
                        else if (xhr.status === 409) {
                            bootbox.alert("Oops, sorry. Your file could not be uploaded because you have reached your free storage limit.");
                        }
                        else {
                            $location.path("/home");
                            $scope.$apply();
                        }
                    }
                };
                xhr.onload = function () {};
                xhr.send(fd);
            }
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
    $scope.uploadPopup = function () {
        if ($scope.files[0] != null) {
            var title = "Your file is ready for uploading."
            var message = "New uploaded files will appear automatically in your collection. You can rename your files and add tags there."
            if ($scope.files.length > 1) {
                title = "Your files are ready for uploading."
            }
            var modal = bootbox.dialog({
                message: message
                , title: title
                , buttons: [
                    {
                        label: "Cancel"
                        , className: "btn btn-default"
                        , callback: function () {
                            $location.path("/home");
                            modal.modal("hide");
                            return false;
                        }
          }, {
                        label: "<span class='glyphicon glyphicon-ok'></span> Upload!"
                        , className: "btn btn-success"
                        , callback: function () {
                            $scope.uploadFile();
                            $location.path("/home");
                            modal.modal("hide");
                            return false;
                        }
          }
        ]
                , show: false
                , onEscape: function () {
                    modal.modal("hide");
                }
            });
            modal.modal("show");
        }
    };
    $scope.uploadFileTypeErrorPopup = function () {
        var title = "Error uploading file."
        var message = "Sorry, it seems you are trying to upload an unsupported file. Our platform only allows PDF, JPG and PNG files."
        var modal = bootbox.dialog({
            message: message
            , title: title
            , buttons: [
                {
                    label: "<span class='glyphicon glyphicon-ok'></span> Upload another file"
                    , className: "btn btn-primary"
                    , callback: function () {
                        $scope.uploadFile();
                        $location.path("/upload");
                        modal.modal("hide");
                        return false;
                    }
          }, {
                    label: "<span class='glyphicon glyphicon-ok'></span> Go to Home"
                    , className: "btn btn-default"
                    , callback: function () {
                        $scope.uploadFile();
                        $location.path("/home");
                        modal.modal("hide");
                        return false;
                    }
          }
        ]
            , show: false
            , onEscape: function () {
                modal.modal("hide");
            }
        });
        modal.modal("show");
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
});
//----------------------
//show controller
//----------------------
app.controller("show", function ($scope, $http, $location, fileService, $route, $routeParams) {
    jq("#loading").show();
    jq('#showSection').hide();
    jq('#imageSection').hide();
    var user = sessionStorage.getItem("username");
    var token = sessionStorage.getItem("japo-token");
    //
    $scope.goToHome = function () {
        $location.path("/home");
    }
    $scope.file;
    $http({
        method: 'GET'
        , url: '/getFileInformation?filename=' + $routeParams.filename + '&user=' + user
    }).success(function (data, status, headers, config) {
        $scope.file = data.fileInfo;
        if ($scope.file.customfilename === "undefined" || $scope.file.customfilename === "") {
            $scope.file.customfilename = $scope.file.filename.split("|")[1];
        }
        $scope.linksList = [];
        getLinkFile(0);
        publishOnPage();
    }).error(function (data, status, headers, config) {});
    //
    function getLinkFile(i) {
        if ($scope.linksList.length < $scope.file.links.length) {
            var index = i;
            $http({
                method: 'GET'
                , url: '/getFileInformation?filename=' + $scope.file.links[index].filename + '&user=' + user
            }).success(function (data, status, headers, config) {
                var linkFile = data.fileInfo;
                var thumbnail = "https://s3.amazonaws.com/" + user.replace("@", "-") + "/thumb_" + data.fileInfo.filename;
                linkFile.thumbnail = thumbnail;
                linkFile.percentage = $scope.file.links[index].percentage;
                if (linkFile.customfilename === "undefined" || linkFile.customfilename === "") {
                    linkFile.customfilename = linkFile.filename.split("|")[1];
                }
                $scope.linksList.push(linkFile);
                getLinkFile(++index);
            });
        }
    }

    function publishOnPage() {
        if ($scope.file.filetype.toUpperCase() === "PDF") {
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
            jq('#showSection').hide();
            jq('#imageSection').show();
        }
    }

    function showPdf() {
        var url = "/getfile?file=" + $scope.file.filename + "&user=" + user;
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
    $scope.showFile = function (file) {
        fileService.saveFile(file);
        $location.path("/show/" + file.filename);
    }
    $scope.editFile = function (file) {
        console.log(file);
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
                        xhr.setRequestHeader("filename", file.filename);
                        xhr.setRequestHeader("customfilename", items.editCustomFilename);
                        xhr.setRequestHeader("tags", items.editTags);
                        xhr.onload = function () {
                            if (xhr.status === 200) {
                                location.reload();
                            }
                        }
                        xhr.send();
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
    $scope.deleteFile = function (filename) {
        bootbox.confirm({
            title: "Delete " + filename.split("|")[1] + "?"
            , message: "You are about to delete " + filename.split("|")[1] + ". Are you sure?"
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