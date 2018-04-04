'use strict';

const Alexa = require('alexa-sdk');
const APP_ID = 'ALEXA_SKILL_ID';  
const log = require('lambda-log');
const request = require('request');
const zlib = require('zlib');

let userid = 'SPUtilities_USER_ID';
let password = 'SPUtilities_PWD';


const welcomeOutput = 'Welcome to Alexa Utility Bill. You can ask me the outstanding amount of your utility bill. Or to check the water, gas and electricity consumption.';
const welcomeReprompt = 'I can check the outstanding amount of your utility bill and the utility usage.';
const spserviceurl = 'jarvis-api-production.apps.spdigital.io';

let electric = 0;
let gas = 0
let water = 0;
let amount = 0;

let speechOutput;


const handlers = {
    'LaunchRequest': function () {
      this.response.speak(welcomeOutput).listen(welcomeReprompt);
      this.emit(':responseReady');
    },
    'consumption': function () {
		let myHandler = this;
		let reprompt;

        let medium = isSlotValid(this.event.request, 'medium');

		SPLogon(userid, password, function(returnValue) {
			returnValue = JSON.parse(returnValue);
			//console.log(returnValue);

			if(returnValue.hasOwnProperty('error')) {
				console.log('Login issue');
				speechOutput = 'Oops there was logon issue. Please try again later.';
				myHandler.response.speak(speechOutput);
				myHandler.emit(':responseReady');
			} else {
				let account_number = returnValue.premises[0].accounts[0].account_number;
				let access_token = returnValue.access_token;

				SPHistory(account_number, access_token, function(returnValue) {
					returnValue = JSON.parse(returnValue);
					electric = returnValue.peer_comparison.electric.mine;
					gas = returnValue.peer_comparison.gas.mine;
					water = returnValue.peer_comparison.water.mine;

					speechOutput = 'Your electricity consumption is ' + electric + ' kilowatt hours, gas consumption is ' + gas + ' kilowatt hours, and water consumption is ' + water + ' cubic meters.';
					myHandler.response.speak(speechOutput);
					myHandler.emit(':responseReady');

					SPLogout(access_token, function(returnValue) {
						console.log('r: ' + returnValue);
					});

				});
				
			}
		});
    },
	'amount': function () {
		let myHandler = this;
		let reprompt;

		SPLogon(userid, password, function(returnValue) {
			returnValue = JSON.parse(returnValue);
			//console.log(returnValue);

			if(returnValue.hasOwnProperty('error')) {
				console.log('Login issue');
				speechOutput = 'Oops there was logon issue. Please try again later.';
				myHandler.response.speak(speechOutput);
				myHandler.emit(':responseReady');
			} else {
				let account_number = returnValue.premises[0].accounts[0].account_number;
				let access_token = returnValue.access_token;

				SPHistory(account_number, access_token, function(returnValue) {
					returnValue = JSON.parse(returnValue);
					amount = returnValue.bill_payment.open_amount;

					speechOutput = 'Your outstanding amount is ' + amount + ' Singapore dollars';
					myHandler.response.speak(speechOutput);
					myHandler.emit(':responseReady');

					SPLogout(access_token, function(returnValue) {
						console.log('r: ' + returnValue);
					});

				});
				
			}
		});
	},	
    'AMAZON.HelpIntent': function () {
        speechOutput = '';
        reprompt = '';
        this.response.speak(speechOutput).listen(reprompt);
        this.emit(':responseReady');
    },
    'AMAZON.CancelIntent': function () {
        speechOutput = '';
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    },
    'AMAZON.StopIntent': function () {
        speechOutput = '';
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    },
    'SessionEndedRequest': function () {
        let speechOutput = '';
        this.response.speak(speechOutput);
        this.emit(':responseReady');
    },
};

exports.handler = (event, context) => {
	log.config.meta.event = event;
	log.config.tags.push(event.env);
	log.info('my lambda function is running!');
    let alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    //alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

function isSlotValid(request, slotName){
	let slot = request.intent.slots[slotName];
    let slotValue;

    //if we have a slot, get the text and store it into speechOutput
    if (slot && slot.value) {
		//we have a value in the slot
        slotValue = slot.value.toLowerCase().trim();
		return slotValue;
	} else {
		//we didn't get a value in the slot.
        return false;
    }
}

function SPHistory(account_number, access_token, callback) {
	let formData = '{"account_number":"' + account_number + '"}';
	let contentLength = formData.length;

	let headers = {
        'Cache-Control': 'no-cache',
		'Authorization': 'Bearer ' + access_token,
		'User-Agent': 'Jarvis/3.3.0 (Android)',
		'Content-Type': 'application/json; charset=UTF-8',
		'Content-Length': contentLength,
		'Host': 'jarvis-api-production.apps.spdigital.io',
		'Connection': 'Keep-Alive',
		'Accept-Encoding': 'gzip'
	}
			
	let options = {
		url: 'https://jarvis-api-production.apps.spdigital.io/v2/history',
		method: 'POST',
		headers: headers,
		body: formData,
	}
	//console.log(options);

	let requestWithEncoding = function(options, callback) {
		let req = request.post(options);

		req.on('response', function(res) {
			let chunks = [];
			res.on('data', function(chunk) {
				chunks.push(chunk);
			});

			res.on('end', function() {
				let buffer = Buffer.concat(chunks);
				let encoding = res.headers['content-encoding'];
				if (encoding == 'gzip') {
					zlib.gunzip(buffer, function(err, decoded) {
						callback(err, decoded && decoded.toString());
					});
				} else if (encoding == 'deflate') {
					zlib.inflate(buffer, function(err, decoded) {
						callback(err, decoded && decoded.toString());
					})
				} else {
					callback(null, buffer.toString());
				}
			});
		});

		req.on('error', function(err) {
			callback(err);
		});
	}

	requestWithEncoding(options, function(err, data) {
		if (err) {
			console.log('err:' + err);
			callback('error');
		} else 
			//console.log(data);
			callback(data);
	})
}

function SPLogon(userid, password, callback) {
	let formData = '{"password":"' + password + '","user_id":"' + userid + '"}';
	let contentLength = formData.length;

	let headers = {
        'Cache-Control': 'no-cache',
		'User-Agent': 'Jarvis/3.3.0 (Android)',
		'Content-Type': 'application/json; charset=UTF-8',
		'Content-Length': contentLength,
		'Host': spserviceurl,
		'Connection': 'Keep-Alive',
		'Accept-Encoding': 'gzip'
	}
			
	let options = {
		url: 'https://' + spserviceurl + '/v2/login',
		method: 'POST',
		headers: headers,
		body: formData,
	}
	//console.log(options);

	let requestWithEncoding = function(options, callback) {
		let req = request.post(options);

		req.on('response', function(res) {
			let chunks = [];
			res.on('data', function(chunk) {
				chunks.push(chunk);
			});

			res.on('end', function() {
				let buffer = Buffer.concat(chunks);
				let encoding = res.headers['content-encoding'];
				if (encoding == 'gzip') {
					zlib.gunzip(buffer, function(err, decoded) {
						callback(err, decoded && decoded.toString());
					});
				} else if (encoding == 'deflate') {
					zlib.inflate(buffer, function(err, decoded) {
						callback(err, decoded && decoded.toString());
					})
				} else {
					callback(null, buffer.toString());
				}
			});
		});

		req.on('error', function(err) {
			callback(err);
		});
	}

	requestWithEncoding(options, function(err, data) {
		if (err) {
			console.log('err:' + err);
			callback('error');
		} else 
			//console.log(data);
			callback(data);
	})
}

function SPLogout(access_token, callback) {
	let headers = {
        'Cache-Control': 'no-cache',
		'Authorization': 'Bearer ' + access_token,
		'User-Agent': 'Jarvis/3.3.0 (Android)',
		'Content-Type': 'application/json; charset=UTF-8',
		'Content-Length': 0,
		'Host': spserviceurl,
		'Connection': 'Keep-Alive',
		'Accept-Encoding': 'gzip'
	}
			
	let options = {
		url: 'https://' + spserviceurl + '/v2/logout',
		method: 'POST',
		headers: headers
	}
	//console.log(options);

	let requestWithEncoding = function(options, callback) {
		let req = request.post(options);

		req.on('response', function(res) {
			let chunks = [];
			res.on('data', function(chunk) {
				chunks.push(chunk);
			});

			res.on('end', function() {
				let buffer = Buffer.concat(chunks);
				let encoding = res.headers['content-encoding'];
				if (encoding == 'gzip') {
					zlib.gunzip(buffer, function(err, decoded) {
						callback(err, decoded && decoded.toString());
					});
				} else if (encoding == 'deflate') {
					zlib.inflate(buffer, function(err, decoded) {
						callback(err, decoded && decoded.toString());
					})
				} else {
					callback(null, buffer.toString());
				}
			});
		});

		req.on('error', function(err) {
			callback(err);
		});
	}

	requestWithEncoding(options, function(err, data) {
		if (err) {
			console.log('err:' + err);
			callback('error');
		} else 
			//console.log(data);
			callback(data);
	})
}
