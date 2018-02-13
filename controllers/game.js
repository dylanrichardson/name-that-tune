const crypto = require('crypto');
const querystring = require('querystring');
const request = require('request');
const Game = require('../models/Game');
const answerController = require('./answer');

const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

const stateKey = 'spotify_auth_state';
const partyKey = 'party_key';
const nameKey = 'name_key';
const partyTokenKey = 'party_token_key';

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
    const party = req.body.party;
    const name = req.body.name;
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
  const state = generateRandomString(16);
  res.cookie(stateKey, state);
  res.cookie(partyKey, party);
  res.cookie(nameKey, name);
  const scope = 'user-modify-playback-state user-read-playback-state';
  res.redirect(`https://accounts.spotify.com/authorize?${querystring.stringify({
    response_type: 'code',
    client_id: spotifyClientId,
    scope,
    redirect_uri: spotifyRedirectURI(req),
    state
  })}`);
}

function spotifyRedirectURI(req) {
  return `${req.protocol}://${req.get('host')}/connect`;
}

/**
 * GET /connect
 * Handle spotify authorization.
 */
exports.connect = (req, res) => {
  console.log('Spotify authorized');
  const code = req.query.code || null;
  const state = req.query.state || null;
  const storedState = req.cookies ? req.cookies[stateKey] : null;

  if ((state === null || state !== storedState)) {
    res.redirect(`/new/#${querystring.stringify({
      error: 'state_mismatch'
    })}`);
  } else {
    res.clearCookie(stateKey);
    const auth = new Buffer(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64');
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code,
        redirect_uri: spotifyRedirectURI(req),
        grant_type: 'authorization_code'
      },
      headers: { Authorization: `Basic ${auth}` },
      json: true
    };

    request.post(authOptions, (error, response, body) => {
      if (!error && response.statusCode === 200) {
        res.redirect(`/connected?${querystring.stringify({
          access_token: body.access_token,
          refresh_token: body.refresh_token
        })}`);
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
exports.connected = (req, res, next) => {
  console.log('Spotify authenticated');
  const accessToken = req.query.access_token;
  const refreshToken = req.query.refresh_token;
  const party = req.cookies ? req.cookies[partyKey] : null;
  const name = req.cookies ? req.cookies[nameKey] : null;
  res.clearCookie(partyKey);
  res.clearCookie(nameKey);

  if (party && name) {
    const token = generateRandomString(16);
    const players = [{ name, token }];
    const game = new Game({ name: party, players, accessToken, refreshToken });
    game.save().then(_ => {
      req.flash('success', { msg: 'Success! Started a new game.' });
      res.cookie(partyTokenKey, token);
      res.redirect(`/game/${encodeURIComponent(party)}`);
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
  const title = 'Join Game';
  const party = req.query.party || '';
  res.render('game/join', { title, party });
};

/**
 * POST /join
 * Join a game.
 */
exports.postJoin = (req, res, next) => {
  const party = req.body.party;
  const name = req.body.name;
  if (party && name) {
    return joinGamePage(party, name).then(d => res.send(d)).catch(next);
  }
  const error = 'incompconste data';
  return res.send({ error });
};

function joinGamePage(party, name) {
  return getGame(party).then(game => {
    const playerNames = game.players.map(p => p.name);
    if (playerNames.includes(name)) {
      const error = 'Someone with your name is already in the party.';
      return { error };
    }
    const token = generateRandomString(16);
    const players = game.players.concat([{ name, token }]);
    return game.update({ players }).then(_ => ({ token }));
  }).catch(error => ({ error }));
}

/**
 * GET /game/:party
 * Game page.
 */
exports.index = (req, res) => {
  const party = req.params.party;
  const title = party;
  getGame(party).then(_ => {
    return res.render('game', { title, party });
  }).catch(err => {
    console.error(err);
    const msg = 'Could not find a party with that name.';
    req.flash('errors', { msg });
    return res.redirect('/join');
  });
};

function getGame(name) {
  return Game.findOne({ name }).then(game => {
    if (!game) throw 'Could not find a party with that name.';
    return game;
  });
}

const answer = (io, id) => data => {
  const question = data.text;
  const party = data.party;
  io.to(party).emit('question', data);
  getGame(party).then(game => {
    const name = data.name;
    const text = data.text;
    const question = { name, text };
    const chat = game.chat.concat([{ question }]);
    return game.update({ chat });
  });
  return answerController.answerQuestion(question, party, id).then(answer => {
    io.to(party).emit('answer', answer);
    return getGame(party).then(game => {
      const chat = game.chat.concat([{ answer }]);
      return game.update({ chat });
    });
  });
};

function leaveGame(io, data) {
  const party = data.party;
  const name = data.party;
  console.log(name, 'leaving', party);
  return getGame(party).then(game => {
    const players = game.players;
    const index = players.map(p => p.name).indexOf(name);
    players.splice(index, 1);
    if (players.length === 0) {
      console.log('deconsting game', party);
      return game.remove();
    }
    io.to(party).emit('players', players.map(p => p.name));
    return game.update({ players });
  }).catch(console.error);
}

function generateRandomString() {
  return crypto.randomBytes(20).toString('hex');
}

const joinGame = (io, socket) => data => {
  const { party, name, token } = data;
  console.log(name, 'joining', party);
  socket.join(party);
  getGame(party).then(game => {
    const chat = game.chat;
    const playerNames = game.players.map(p => p.name);
    if (!playerNames.includes(name)) {
      const players = game.players.concat([{ name, token }]);
      game.update({ players });
      playerNames.push(name);
    }
    return { playerNames, chat };
  }).then(data => {
    io.to(party).emit('players', data.playerNames);
    socket.emit('chat', data.chat);
  });
};

exports.handleSocket = io => socket => {
  let savedData = {};
  const on = (name, handler) => {
    return socket.on(name, data => {
      savedData = data;
      return getGame(data.party).then(game => {
        if (!game.players.map(p => p.token).includes(data.token)) throw 'Invalid token';
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
};
