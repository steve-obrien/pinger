//var express = require('express'),
//	app = express()
var url = require('url'),
	request = require('request'),
	mysql = require('mysql'),
	postmark = require('postmark')('15fa02db-fa13-47cc-853b-e4489f4fb18b'),
	util = require('util');
	$ = require('jquery'),
	_ = require('underscore'),

require('date-utils');

var dbConfig = {
  host     : 'localhost',
  user     : 'root',
  password : ''
}

var dbTable = 'newiconadmin_development.pinger_script';

// when something goes wrong we need to notify peeps
var notify = function(row){
	postmark.send({
		"From": "theteam@newicon.net", 
		"To": "steve@newicon.net", 
		"Subject": "Pinger Test Failed: " + row.name,
		"TextBody": "The following pinger script failed: \n\n " + row.name + ':\n'+row.script+'\n\nLog:\n'+row.last_log,
		"HtmlBody":"The following pinger script failed: <br /><br /> " + row.name + ':<br />'+row.script.replace(/\n/g, '<br />')+'<br/><br/>Log:<br/>'+row.last_log.replace(/\n/g, '<br />')
	});
}

// parse the script "do" test script into a json array
// format:
// [
//   {
//	   cmd: {fun:'goto','args'{}},
//	   tests:[
//	     {fun:'testFunctionName', args:'test arguments'},
//       {fun:'testFunctionName', args:'test arguments'}
//     ]
//	 }, ...
// ] 
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

// define test functions
var testFunctions = {
	shouldSee : function(text, error, reponse, body){
		var res = $('body:contains("'+text+'")', body).length;
		return {
			log: 'should see: "' + text + '" - ' + (res ? 'passed' : 'failed'),
			result: res
		}
	}
};

// ran for each row
var runtest = function(row, txt) {
	txt = txt || '';
	// variable to store log messages
	var log = '';
	var doScript = parseScript(row.script)
	var testResult = false;
	
	_.each(doScript, function(scriptAction){
		
		if (scriptAction.cmd.fun == 'goto'){

			request(scriptAction.cmd.args, function (error, response, body) {
				
				log += 'goto: ' + JSON.stringify(scriptAction.cmd.args.uri.host);
				
				testResult = (!error && response.statusCode == 200);
				log += (testResult ? ' - success' : ' - failed with response code: '+response.statusCode);
				
				_.each(scriptAction.tests, function(test){
					if (testResult == false) return;
					var ret = testFunctions[test.fun].call(this, test.args, error, response, body);
					testResult = ret.result;
					log += '\n' + ret.log + '';
				});
				
				log += "\nTest status: " + (testResult ? 'PASSED' : 'FAILED') + '\n';
	
				// should be able to use a previous db connection but this script stays running... so should I never bother
				// closing the connection ??
				var db = mysql.createConnection(dbConfig);db.connect();
				var update = {
					last_test_passed : testResult ? 1 : 0, 
					last_tested      : new Date().toFormat('YYYY-MM-DD HH24:MI:SS'),
					last_log         : log
				};
				db.query('UPDATE '+dbTable+' SET ? WHERE id = ' + row.id, update,function(err, result) {
					if (err) throw err;
				});
				db.end();
				
				if (!testResult)
					notify(_.extend(row, update));
				
				console.log(log);
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
setInterval(tick, 10000)