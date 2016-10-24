//INIT van module
var app = angular.module("loginApp", []); //name van de app en andere modules kunnen toegevoegd worden in [].

//INIT van controllers
app.controller("addController", function ($scope, $http) {

    $scope.Submit = function () {

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


        /*guitarList.push({                  //gegevens van de textbox in een array pushen
            "name": $scope.naamInput,
            "soort": $scope.houtsoortInput,
            "prijs": $scope.prijsInput
        });
        
        $scope.naamInput = "";          //clear textbox after submit
        $scope.houtsoortInput = "";
        $scope.prijsInput = "";
        //console.log(guitarList);*/
    }
})
