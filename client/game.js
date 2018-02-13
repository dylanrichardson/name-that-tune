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
