var express = require('express');
var app = express();
var url = require('url');
var request = require('request');
var $ = require('jquery');
var mysql = require('mysql');
var _ = require('underscore');

var dbConfig = {
  host     : 'localhost',
  user     : 'root',
  password : '',
}

function executeFunctionByName(functionName, context) {
	var args = Array.prototype.slice.call(arguments).splice(2);
	var namespaces = functionName.split(".");
	var func = namespaces.pop();
	for(var i = 0; i < namespaces.length; i++) {
		context = context[namespaces[i]];
	}
	return context[func].apply(this, args);
}

// when something goes wrong we need to notify peeps
var notify = function(){

}

var shoudSee = function(text, error, reponse, body){
	return $('body:contains("'+text+'")', body).length;
}

var runtest = function(row, txt) {
	txt = txt || '';

	doScript = [];
	// parse script
    var lines = row.script.match(/^.*((\r\n|\n|\r)|$)/gm);
	for (l=0; l<=lines.length; l++) {

	    var line = lines[l];
	    if (line == '' || line == undefined) continue;

	    // search for goto command
	    var m = line.match(/(goto) (.*)/)
	    if(m != null) {if (m.length > 2 && m[1] == 'goto'){
	    	// found goto line
	    	// look for following test commands

	    	goto = m[2].replace(/\s/g, "X");
	    	var cmd = {goto:m[2].replace(/\s/g, "X"), tests:[]};
	    	doScript.push(cmd);
	    	continue;                
	    }}
	    
	    // search for sub goto commands
	    var m = lines[l].match(/(i should see) (.*)/)
	    if(m != null) {if(m.length > 2 && m[1] == 'i should see'){
            cmd.tests.push({fun:'shouldSee', args:m[2]});
	    }}
	}


	_.each(doScript, function(command){

		var options = {
		  uri: url.parse(command.goto),
		  path: '/',
		  port: '80',
		  followRedirect:true
		};
		var request = require('request');
		request(options, function (error, response, body) {
			var tests = false;
			_.each(command.tests, function(test){
				tests = executeFunctionByName(test.fun, this, test.args, error, response, body);
			});
			if(tests)
				console.log('tests passed!');
			else
				console.log('tests failed!');

			if (!error && response.statusCode == 200) {
				// var textFound = $('body:contains("'+shouldSee+'")', body);
				// if(textFound.length)
				// 	console.log(txt + ' FOUND TEXT ' + shouldSee);
				// else
				// 	console.log('ERROR: Did not find text Newicon')
				console.log('passed')
			} else {
				console.log('ERROR: status code not 200')
			}
		})
		
			
	});

	console.log(doScript)

}

var ticker = 0;
var tick = function(){
	console.log('TICK!!!!!!!!!!!!!!!');
	// create a new db connection for each tick.
	var connection = mysql.createConnection(dbConfig);
	connection.connect();
	

	connection.query('SELECT * from newiconadmin_development.pinger_script', function(err, rows, fields) {
		if (err) throw err;
		_.each(rows, function(row){
			runtest(row, ticker)
		})
	});

	ticker += 1;
	

	connection.end();
}

tick();
setInterval(tick, 2000)