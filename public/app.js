var app = angular.module('Japo-app', ['ngRoute']);

app.config(function($routeProvider) {
  $routeProvider
   .when("/", {
    templateUrl : "login.html"
  })
  .when("/registered", {
    templateUrl : "registered.html"
  })
  .when("/home", {
    templateUrl : "home.html"
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
            , "body": loginPass
        }).success(function (post) {
            console.log(post);
            console.log("inloggen nu en redirecten")
            $location.path("/home");
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
            console.log("posting to create user");
            $http.post("/api/createUser", {
                "fname": fname
                , "lname": lname
                , "email": email
                , "password": password
            }).success(function (post) {
                console.log(post);
                console.log("We gaan nu redirecten!!")
                $location.path("/registered");
            });
        }
    }
});




// -----------------
// Upload Controller
// -----------------
app.controller("uploadController", function ($scope, $http, $location) {
    $scope.LogIn = function () {
        
        //post req
        $http.post("/api/authenticate", {
            "name": emailUser
            , "body": loginPass
        }).success(function (post) {
            console.log(post);
            console.log("inloggen nu en redirecten")
            $location.path("/home");
        });
    }
});


// ---------------
// Home Controller
// ---------------

app.controller("homeController", function ($scope, $http) {
    $scope.collection = [];

    $scope.collection.push({
        titel: "pdf1",
        grootte: "50Mb",
        tags: "factuur",
        datum: "17/11/2016",
        thumbnail: "/pdf/pdflogo.jpg"
    });
    $scope.collection.push({
        titel: "pdf2",
        grootte: "10Mb",
        tags: "telenet",
        datum: "17/11/2016",
        thumbnail: "/pdf/pdflogo.jpg"
    });
    $scope.collection.push({
        titel: "pdf3",
        grootte: "6Mb",
        tags: "contract",
        datum: "17/11/2016",
        thumbnail: "/pdf/pdflogo.jpg"
    });
    $scope.collection.push({
        titel: "pdf4",
        grootte: "118Mb",
        tags: "factuur",
        datum: "17/11/2016",
        thumbnail: "/pdf/pdflogo.jpg"
    });

    console.log($scope.collection);
});