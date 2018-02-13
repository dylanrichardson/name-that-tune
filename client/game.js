window.game = () => {

  // dependencies

  const Cookies = require('js-cookie');

  // initialization

  const tokenKey = 'party_token_key';
  const name = sessionStorage.getItem('name_key');
  const party = decodeURIComponent(window.location.pathname.substring(6));
  if (!name) {
    sessionStorage.clear();
    Cookies.remove(tokenKey);
    window.location = `/join?party=${encodeURIComponent(party)}`;
  }
  $('#name').html(name);

  let token = sessionStorage.getItem(tokenKey);
  if (!token) {
    console.log('party token not found in session');
    token = Cookies.get(tokenKey);
    sessionStorage.setItem(tokenKey, token);
  }

  Cookies.remove(tokenKey);

  let playerNames = [name];
  const questionInput = document.getElementById('question');
  let chatLoaded = false;

  const SpeechRecognition = webkitSpeechRecognition || SpeechRecognition;
  const SpeechGrammarList = webkitSpeechGrammarList || SpeechGrammarList;
  const SpeechRecognitionEvent = webkitSpeechRecognitionEvent || SpeechRecognitionEvent;
  const grammar = '#JSGF V1.0;';
  const recognition = new SpeechRecognition();
  const speechRecognitionList = new SpeechGrammarList();
  speechRecognitionList.addFromString(grammar, 1);
  recognition.grammars = speechRecognitionList;
  // recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const socket = io.connect();


  // functions

  function leaveGame() {
    console.log('being kicked');
    sessionStorage.clear();
    Cookies.remove(tokenKey);
    window.location = '/';
  }

  function updatePlayers(players) {
    console.log('players', players);
    playerNames = players;
    const playersHTML =  + playerNames.reduce((t, p) => t + `<div>${p}</div>`, '');
    $('#players').html(`players${playersHTML}`);
  }

  function saveToChat(text) {
    socket.emit('question', { text, name, party, token });
  }

  function speech() {
    console.log('starting recognition');
    recognition.start();
  }

  function addQuestion(text, name) {
    const str = `
      <div class="row">
        <div class="col-sm-4">
          <div class="well well-sm">
            ${name}: ${text}
          </div>
        </div>
      </div>`;
    const textBox = $.parseHTML(str);
    $('#chat').append(textBox);
  }

  function addAnswer(text) {
    const str = `
      <div class="row">
        <div class="col-sm-offset-8 col-sm-4">
          <div class="well well-sm">
            ${text}
          </div>
        </div>
      </div>`;
    const textBox = $.parseHTML(str);
    $('#chat').append(textBox);
  }

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

  // event handlers

  recognition.onresult = event => {
    const last = event.results.length - 1;
    const text = event.results[last][0].transcript;
    addQuestion(text, name);
    console.log('text', text);
    console.log(`Confidence: ${event.results[0][0].confidence}`);
  };

  recognition.onspeechend = () => {
    recognition.stop();
  };

  recognition.onnomatch = _ => {
    console.log('Could not understand that');
  };

  questionInput.onkeydown = event => {
    if (event.keyCode === 13) {
      const text = questionInput.value;
      questionInput.value = '';
      addQuestion(text, name);
      saveToChat(text);
    }
  };

  socket.on('connect', () => socket.emit('room', { party, name, token }));

  socket.on('question', data => {
    if (data.name !== name) {
      addQuestion(data.text, data.name);
    }
  });

  socket.on('answer', addAnswer);

  socket.on('players', updatePlayers);

  socket.on('kick', leaveGame);

  socket.on('chat', loadChat);

};
