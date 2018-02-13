(function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
window.game = () => {

  let Cookies = require('js-cookie');

  let partyTokenKey = 'party_token_key';
  let name = sessionStorage.getItem('name_key');
  let party = decodeURIComponent(window.location.pathname.substring(6));
  if (!name) {
    sessionStorage.clear();
    Cookies.remove(partyTokenKey);
    window.location = '/join?party=' + encodeURIComponent(party)
  }
  $('#name').html(name);

  let partyToken = sessionStorage.getItem(partyTokenKey);
  if (!partyToken) {
    console.log('party token not found in session');
    partyToken = Cookies.get(partyTokenKey);
    sessionStorage.setItem(partyTokenKey, partyToken);
  }
  Cookies.remove(partyTokenKey);

  let playerNames = [name];
  let questionInput = document.getElementById('question');
  var chatLoaded = false;

  let SpeechRecognition = webkitSpeechRecognition || SpeechRecognition;
  let SpeechGrammarList = webkitSpeechGrammarList || SpeechGrammarList;
  let SpeechRecognitionEvent = webkitSpeechRecognitionEvent || SpeechRecognitionEvent;
  let grammar = '#JSGF V1.0;';
  let recognition = new SpeechRecognition();
  let speechRecognitionList = new SpeechGrammarList();
  speechRecognitionList.addFromString(grammar, 1);
  recognition.grammars = speechRecognitionList;
  //recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = function(event) {
    var last = event.results.length - 1;
    var text = event.results[last][0].transcript;
    addToChat(text, name);
    console.log('text', text)
    console.log('Confidence: ' + event.results[0][0].confidence);
  }

  recognition.onspeechend = function() {
    recognition.stop();
  }

  recognition.onnomatch = function(event) {
    console.log('Could not understand that');
  }

  questionInput.onkeydown = function(event) {
      if (event.keyCode == 13) {
          let text = questionInput.value;
          questionInput.value = '';
          addQuestion(text, name);
          saveToChat(text);
      }
  }

  let socket = io.connect();

  socket.on('connect', () => socket.emit('room', {
    party: party,
    name: name,
    token: partyToken
  }));

  socket.on('question', function (data) {
    if (data.name !== name) {
      addQuestion(data.text, data.name);
    }
  });

  socket.on('answer', addAnswer);

  socket.on('players', updatePlayers);

  socket.on('kick', leaveGame);

  socket.on('chat', loadChat);

  function loadChat(data) {
    if (!chatLoaded) {
      data.forEach(({ question, answer }) => {
        if (question) {
          addQuestion(question.text, question.name);
        } else {
          addAnswer(answer);
        }
      });
      chatLoaded = true;
    }
  }

  function leaveGame() {
    console.log('being kicked');
    sessionStorage.clear();
    Cookies.remove(partyTokenKey);
    window.location = '/';
  }

  function updatePlayers(players) {
    console.log('players', players);
    playerNames = players;
    $('#players').html('players' + playerNames.reduce((t, p) => t + `<div>${p}</div>`, ''));
  }

  function saveToChat(text) {
    socket.emit('question', {
      text: text,
      name: name,
      party: party,
      token: partyToken
    });
  }

  function speech() {
    console.log('starting recognition');
    recognition.start();
  }

  function addQuestion(text, name) {
    let str = `
      <div class="row">
        <div class="col-sm-4">
          <div class="well well-sm">
            ${name}: ${text}
          </div>
        </div>
      </div>`;
    let textBox = $.parseHTML(str);
    $('#chat').append(textBox);
  }

  function addAnswer(text) {
    let str = `
      <div class="row">
        <div class="col-sm-offset-8 col-sm-4">
          <div class="well well-sm">
            ${text}
          </div>
        </div>
      </div>`;
    let textBox = $.parseHTML(str);
    $('#chat').append(textBox);
  }

}

},{"js-cookie":4}],2:[function(require,module,exports){
window.join = () => {

  $('#join').on('submit', function(e) {
    e.preventDefault();
    //let csrf = #{_csrf};
    let party = $('#party').val();
    let name = $('#name').val();
    let data = {
      party: party,
      name: name
    };
    sessionStorage.removeItem('party_token_key');
    $.post('/join', data, data => {
      if (data.error) {
        console.log(data.error);
      } else {
        sessionStorage.setItem('party_key', party);
        sessionStorage.setItem('name_key', name);
        sessionStorage.setItem('party_token_key', data.token);
        window.location = '/game/' + encodeURIComponent(party);
      }
    })
  });

}

},{}],3:[function(require,module,exports){
window.newGame = () => {

  $('#new-game').on('submit', function(e) {
    let party = $('#party').val();
    let name = $('#name').val();
    sessionStorage.setItem('party_key', party);
    sessionStorage.setItem('name_key', name);
    sessionStorage.removeItem('party_token_key');
  });

}

},{}],4:[function(require,module,exports){
/*!
 * JavaScript Cookie v2.2.0
 * https://github.com/js-cookie/js-cookie
 *
 * Copyright 2006, 2015 Klaus Hartl & Fagner Brack
 * Released under the MIT license
 */
;(function (factory) {
	var registeredInModuleLoader = false;
	if (typeof define === 'function' && define.amd) {
		define(factory);
		registeredInModuleLoader = true;
	}
	if (typeof exports === 'object') {
		module.exports = factory();
		registeredInModuleLoader = true;
	}
	if (!registeredInModuleLoader) {
		var OldCookies = window.Cookies;
		var api = window.Cookies = factory();
		api.noConflict = function () {
			window.Cookies = OldCookies;
			return api;
		};
	}
}(function () {
	function extend () {
		var i = 0;
		var result = {};
		for (; i < arguments.length; i++) {
			var attributes = arguments[ i ];
			for (var key in attributes) {
				result[key] = attributes[key];
			}
		}
		return result;
	}

	function init (converter) {
		function api (key, value, attributes) {
			var result;
			if (typeof document === 'undefined') {
				return;
			}

			// Write

			if (arguments.length > 1) {
				attributes = extend({
					path: '/'
				}, api.defaults, attributes);

				if (typeof attributes.expires === 'number') {
					var expires = new Date();
					expires.setMilliseconds(expires.getMilliseconds() + attributes.expires * 864e+5);
					attributes.expires = expires;
				}

				// We're using "expires" because "max-age" is not supported by IE
				attributes.expires = attributes.expires ? attributes.expires.toUTCString() : '';

				try {
					result = JSON.stringify(value);
					if (/^[\{\[]/.test(result)) {
						value = result;
					}
				} catch (e) {}

				if (!converter.write) {
					value = encodeURIComponent(String(value))
						.replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);
				} else {
					value = converter.write(value, key);
				}

				key = encodeURIComponent(String(key));
				key = key.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent);
				key = key.replace(/[\(\)]/g, escape);

				var stringifiedAttributes = '';

				for (var attributeName in attributes) {
					if (!attributes[attributeName]) {
						continue;
					}
					stringifiedAttributes += '; ' + attributeName;
					if (attributes[attributeName] === true) {
						continue;
					}
					stringifiedAttributes += '=' + attributes[attributeName];
				}
				return (document.cookie = key + '=' + value + stringifiedAttributes);
			}

			// Read

			if (!key) {
				result = {};
			}

			// To prevent the for loop in the first place assign an empty array
			// in case there are no cookies at all. Also prevents odd result when
			// calling "get()"
			var cookies = document.cookie ? document.cookie.split('; ') : [];
			var rdecode = /(%[0-9A-Z]{2})+/g;
			var i = 0;

			for (; i < cookies.length; i++) {
				var parts = cookies[i].split('=');
				var cookie = parts.slice(1).join('=');

				if (!this.json && cookie.charAt(0) === '"') {
					cookie = cookie.slice(1, -1);
				}

				try {
					var name = parts[0].replace(rdecode, decodeURIComponent);
					cookie = converter.read ?
						converter.read(cookie, name) : converter(cookie, name) ||
						cookie.replace(rdecode, decodeURIComponent);

					if (this.json) {
						try {
							cookie = JSON.parse(cookie);
						} catch (e) {}
					}

					if (key === name) {
						result = cookie;
						break;
					}

					if (!key) {
						result[name] = cookie;
					}
				} catch (e) {}
			}

			return result;
		}

		api.set = api;
		api.get = function (key) {
			return api.call(api, key);
		};
		api.getJSON = function () {
			return api.apply({
				json: true
			}, [].slice.call(arguments));
		};
		api.defaults = {};

		api.remove = function (key, attributes) {
			api(key, '', extend(attributes, {
				expires: -1
			}));
		};

		api.withConverter = init;

		return api;
	}

	return init(function () {});
}));

},{}]},{},[1,2,3]);
