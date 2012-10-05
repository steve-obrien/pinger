var express = require('express');
var app = express();
var url = require('url');
var request = require('request');
var $ = require('jquery');
var mysql = require('mysql');
var _ = require('underscore');
var postmark = require('postmark')('15fa02db-fa13-47cc-853b-e4489f4fb18b');
require('date-utils');

var dbConfig = {
  host     : 'localhost',
  user     : 'root',
  password : ''
}

var dbTable = 'newiconadmin_development.pinger_script';

var testFunctions = {
	shouldSee : function(text, error, reponse, body){
		console.log('should see: ' + text);
		return $('body:contains("'+text+'")', body).length;
	}
};


// when something goes wrong we need to notify peeps
var notify = function(){
	// TODO: send an email or something.
	
}

var parseScript = function(script){
	doScript = [];
	// parse script
    var lines = script.match(/^.*((\r\n|\n|\r)|$)/gm);
	for (l=0; l<=lines.length; l++) {

	    var line = lines[l];
	    if (line == '' || line == undefined) continue;

	    // search for goto command
	    var m = line.match(/(goto) (.*)/)
	    if(m != null) {if (m.length > 2 && m[1] == 'goto'){
	    	// found goto line
	    	// look for following test commands

	    	var scriptAction = {
				cmd:{
					fun:'goto', 
					args:{
						uri:url.parse(m[2].replace(/\s/g, "X")), 
						port:80,
						followRedirect:true,
						path:'/'
					}
				},
				tests:[]
			};
	    	doScript.push(scriptAction);
	    	continue;                
	    }}
	    
	    // search for sub goto commands
	    var m = lines[l].match(/(i should see) (.*)/)
	    if(m != null) {if(m.length > 2 && m[1] == 'i should see'){
            scriptAction.tests.push({fun:'shouldSee', args:m[2]});
	    }}
	
	}
	return doScript;
}



var runtest = function(row, txt) {
	txt = txt || '';
	
	var doScript = parseScript(row.script)

	_.each(doScript, function(scriptAction){

		if(scriptAction.cmd.fun == 'goto'){
			
			console.log('goto: ' + JSON.stringify(scriptAction.cmd.args.uri.host));
			var request = require('request');
			request(scriptAction.cmd.args, function (error, response, body) {
			
				var testsResult = false;
				
				if (!error && response.statusCode == 200)
					testsResult = true;

				_.each(scriptAction.tests, function(test){
					if (!testsResult) return;
					testsResult = testFunctions[test.fun].call(this, test.args, error, response, body);
				});
				
				
				
				if (!testsResult) {
					postmark.send({
						"From": "theteam@newicon.net", 
						"To": "steve@newicon.net", 
						"Subject": "Pinger Test Failed: " + row.name,
						"TextBody": "The following pinger script failed: \n\n " + row.name + ':\n'+row.script,
						"HtmlBody":"The following pinger script failed: <br /><br /> " + row.name + ':<br />'+row.script
					});
					
				}
				
				// should be able to use a previous db connection but this script stays running... so should I never bother
				// closing the connection ??
				var db = mysql.createConnection(dbConfig);db.connect();
				db.query('UPDATE '+dbTable+' SET ? WHERE id = ' + row.id,{
					last_test_passed	: testsResult ? 1 : 0, 
					last_tested			: new Date().toFormat('YYYY-DD-MM HH24:MI:SS')}, 
					function(err, result) {
						if (err) throw err;
					}
				);
				db.end();
				console.log(testsResult ? 'PASSED' : 'FAILED');
			})
		}
		
	});
}

var ticker = 0;
var tick = function(){
	console.log('TICK!!!!!!!!!!!!!!!');
	// create a new db connection for each tick.
	var connection = mysql.createConnection(dbConfig);
	connection.connect();

	connection.query('SELECT * from '+dbTable, function(err, rows, fields) {
		if (err) throw err;
		_.each(rows, function(row){
			if(row.enabled)
				runtest(row, ticker)
		})
	});

	ticker += 1;

	connection.end();
}

tick();
setInterval(tick, 60000)