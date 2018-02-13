let crypto = require('crypto');
let querystring = require('querystring');
let request = require('request');
let Game = require('../models/Game');
let answerController = require('./answer');

let spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
let spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

let stateKey = 'spotify_auth_state';
let partyKey = 'party_key';
let nameKey = 'name_key';
let spotifyKey = 'spotify_key';
let partyTokenKey = 'party_token_key';

/**
 * GET /new
 * New game page.
 */
exports.getNew = (req, res) => {
  res.render('game/new', {
    title: 'New Game'
  });
};

/**
 * POST /new
 * Start a new game.
 */
exports.postNew = (req, res) => {
  console.log('Trying to create new game');
  req.assert('party', 'Party name cannot be blank').notEmpty();
  req.assert('name', 'Your name cannot be blank').notEmpty();
  req.getValidationResult().then(errors => {
    if (!errors.isEmpty()) {
      req.flash('errors', errors.array());
      return res.redirect('/new');
    }
    let party = req.body.party;
    let name = req.body.name;
    // check if party name exists
    Game.findOne({ name: party }).then(game => {
      if (game) {
        req.flash('errors', { msg: 'Party with that name already exists.' });
        return res.redirect('/new');
      }
      // connect to Spotify
      connectSpotify(req, res, party, name);
    });
  });
};

function connectSpotify(req, res, party, name) {
  console.log('Connecting to Spotify');
  let state = generateRandomString(16);
  res.cookie(stateKey, state);
  res.cookie(partyKey, party);
  res.cookie(nameKey, name);
  let scope = 'user-modify-playback-state user-read-playback-state';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: spotifyClientId,
      scope: scope,
      redirect_uri: spotifyRedirectURI(req),
      state: state
    }));
}

function spotifyRedirectURI(req) {
  return req.protocol + '://' + req.get('host') + '/connect';
}

/**
 * GET /connect
 * Handle spotify authorization.
 */
exports.connect = (req, res) => {
  console.log('Spotify authorized');
  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;

  if ((state === null || state !== storedState)) {
    res.redirect('/new/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: spotifyRedirectURI(req),
        grant_type: 'authorization_code'
      },
      headers: {
        Authorization: 'Basic ' + (new Buffer(spotifyClientId + ':' + spotifyClientSecret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {
        // we can also pass the token to the browser to make requests from there
        res.redirect('/connected?' +
          querystring.stringify({
            access_token: body.access_token,
            refresh_token: body.refresh_token
          }));
      } else {
        console.error(error, body);
        req.flash('errors', { msg: 'Invalid Spotify token.' });
        res.redirect('/new');
      }
    });
  }
};

/**
 * GET /connected
 * Handle spotify authentication.
 */
exports.connected =  (req, res, next) => {
  console.log('Spotify authenticated');
  let accessToken = req.query.access_token;
  let refreshToken = req.query.refresh_token;
  let party = req.cookies ? req.cookies[partyKey] : null;
  let name = req.cookies ? req.cookies[nameKey] : null;
  res.clearCookie(partyKey);
  res.clearCookie(nameKey);

  if (party && name) {
    let token = generateRandomString(16);
    let game = new Game({
      name: party,
      players: [{
        name: name,
        token: token
      }],
      accessToken: accessToken,
      refreshToken: refreshToken
    });
    game.save().then( _ => {
      req.flash('success', { msg: 'Success! Started a new game.' });
      res.cookie(partyTokenKey, token);
      res.redirect('/game/' + encodeURIComponent(party));
    }).catch(next);
  } else {
    console.log('Party and name not found in cookies');
    return res.redirect('/');
  }
};

/**
 * GET /join
 * Join game page.
 */
exports.getJoin = (req, res) => {
  res.render('game/join', {
    title: 'Join Game',
    party: req.query.party || ''
  });
}

/**
 * POST /join
 * Join a game.
 */
exports.postJoin = (req, res, next) => {
  let party = req.body.party;
  let name = req.body.name;
  if (party && name) {
    return joinGamePage(party, name).then(d => res.send(d)).catch(next);
  } else {
    return res.send({ error: 'incomplete data' });
  }
};

function joinGamePage(party, name) {
  return getGame(party).then(game => {
    let playerNames = game.players.map(p => p.name);
    if (playerNames.includes(name)) {
      return { error: 'Someone with your name is already in the party.' };
    }
    let token = generateRandomString(16);
    return game.update({
      players: game.players.concat([{
        name: name,
        token: token
      }])
    }).then( _ => ({ token: token }));
  }).catch(e => { error: e });
};

/**
 * GET /game/:party
 * Game page.
 */
exports.index = (req, res, next) => {
  let party = req.params.party;
  getGame(party).then(game => {
    return res.render('game', {
      title: party,
      party: party
    });
  }).catch(err => {
    console.error(err);
    req.flash('errors', { msg: 'Could not find a party with that name.' });
    return res.redirect('/join');
  });
};

function getGame(name) {
  return Game.findOne({ name: name }).then(game => {
    if (!game) throw 'Could not find a party with that name.';
    return game;
  });
}

let answer = (io, id) => data => {
  let question = data.text;
  let party = data.party;
  io.to(party).emit('question', data);
  getGame(party).then(game => {
    return game.update({
      chat: game.chat.concat([{
        question: {
          name: data.name,
          text: data.text
        }
      }])
    })
  });
  return answerController.answerQuestion(question, party, id).then(answer => {
    io.to(party).emit('answer', answer);
    return getGame(party).then(game => {
      return game.update({
        chat: game.chat.concat([{
          answer: answer
        }])
      });
    })
  });
};

function leaveGame(io, data) {
  let party = data.party;
  let name = data.party;
  console.log(name, 'leaving', party);
  return getGame(party).then(game => {
    let players = game.players;
    let index = players.map(p => p.name).indexOf(name);
    players.splice(index, 1);
    if (players.length === 0) {
      console.log('deleting game', party)
      return game.remove();
    }
    io.to(party).emit('players', players.map(p => p.name));
    return game.update({ players: players });
  }).catch(console.error);
}

function generateRandomString() {
  return crypto.randomBytes(20).toString('hex');
}

let joinGame = (io, socket) => data => {
  let party = data.party;
  let name = data.name;
  console.log(name, 'joining', party);
  socket.join(party);
  getGame(party).then(game => {
    let playerNames = game.players.map(p => p.name);
    if (!playerNames.includes(name)) {
      game.update({
        players: game.players.concat([{
          name: name,
          token: data.token
        }])
      });
      playerNames.push(name);
    }
    return { playerNames, chat: game.chat };
  }).then(data => {
    io.to(party).emit('players', data.playerNames);
    socket.emit('chat', data.chat);
  });
}

exports.handleSocket = io => socket => {
  var savedData = {};
  let on = (name, handler) => {
    return socket.on(name, data => {
      savedData = data;
      return getGame(data.party).then(game => {
        if (!game.players.map(p => p.token).includes(data.token))
          throw 'Invalid token';
        return handler(data);
      }).catch(e => {
        console.error(e);
        socket.emit('kick');
      });
    });
  };
  on('room', joinGame(io, socket));
  on('question', answer(io, socket.id));
  socket.on('disconnect', () => leaveGame(io, savedData));
}
