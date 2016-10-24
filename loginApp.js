//INIT van module
var app = angular.module("loginApp", []); //name van de app en andere modules kunnen toegevoegd worden in [].

//INIT van controllers
app.controller("addController", function ($scope, $http) {

    $scope.$watch('pass2', function (newValue, oldValue) {
        console.log($scope.pass2);
        if ($scope.pass2 === "" || $scope.pass2 == null) {
            $scope.icon = "form-control-feedback"
        }
        else {
            if ($scope.pass1 === $scope.pass2) {
                $scope.icon = "glyphicon glyphicon-ok form-control-feedback"
            } else {
                $scope.icon = "glyphicon glyphicon-remove form-control-feedback";
            }
        }
    });

    $scope.Submit = function () {

        //gegevens ophalen sign in

        var emailUser = $scope.email;
        var loginPass = $scope.password;

        //post req

        $http.post("/api/authentication", {
            "name": emailUser,
            "body": loginPass
        }).success(function (post) {
            console.log(post);
            $scope.posts.unshift(post);
        });

    }

    $scope.Register = function () {

        //gegevens ophalen register

        var fName = $scope.name;
        var lName = $scope.lastName;
        var email = $scope.newEmail;
        var pass1 = $scope.pass1;
        var passwordConf = $scope.pass2;

        //post req
        if ($scope.pass1 === $scope.pass2) {
            $http.post("/api/createUser", {
                "fName": fName,
                "lName": lName,
                "email": email,
                "passwordConfirm": passwordConf
            }).success(function (post) {
                console.log(post);
                $scope.posts.unshift(post);
            });
        }
    }
})
