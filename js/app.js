var japoApp = angular.module("japoApp", []);

veloApp.controller("japoController", function($scope, $http, $filter) {
	$http.get("http://localhost:3000/lala").success(function(stations) {

	}).error(function(err) {
		console.log(err);
	});

});
