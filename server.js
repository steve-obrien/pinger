var express = require('express');
var app = express();
var url = require('url');
var request = require('request');
var $ = require('jquery');


var makerequest = function() {

	var options = {
	  uri: url.parse('http://newicon.net'),
	  path: '/',
	  port: '80',
	  followRedirect:true
	};

	var request = require('request');
	request(options, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			console.log(body) // Print the google web page.
			var textFound = $('body:contains("Newicon")', body);
			console.log(textFound.length)
			if(textFound.length)
				console.log('FOUND TEXT Newicon');
		}
	})
}


app.get('/', function(req, res){
	setTimeout(function(){console.log('hello')} , 2000);
	res.send('hello world <a href="/do">do</a>');
 
})
 
app.get('/do', function(req, res){
	console.log('dodododod');
	makerequest();
 	res.send('do');
})
 
app.listen(3000);
console.log('Listening on port 3000');

