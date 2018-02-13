const dialogflow = require('apiai');
const rhyme = require('rhyme');
const fuzzy = require('fuzzyset');
const request = require('request');
const axios = require('axios');
const Game = require('../models/Game');

const dialogflowClient = dialogflow(process.env.DIALOGFLOW_ACCESS_TOKEN);
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

function getIntent(question, sessionId) {
  return new Promise((resolve, reject) => {
    const request = dialogflowClient.textRequest(question, { sessionId });
    request.on('response', res => resolve(res.result));
    request.on('error', reject);
    request.end();
  });
}

async function handleIntent(result, party) {
  console.log('answering question for', party);

  // initialization

  const existingGame = await Game.findOne({ name: party }).then(existingGame => {
    if (!existingGame) throw { name: 'custom', msg: 'Could not find a party with that name.' };
    return existingGame;
  });
  let spotifyAccessToken = existingGame.accessToken;

  const intent = result.metadata.intentName;

  return _handle();

  // local functions

  function hint() {
    return spotify(getPlaying).then(async ({ artist, related, date }) => {
      const random = Math.random();
      if (random > 0.6) {
        const other = getRandomElement(related.slice(0, related.length / 2));
        return `The artist is similar to ${other}`;
      } else if (random > 0.4) {
        return `This song was released in ${printYear(date)}`;
      } else if (random > 0.15) {
        return `The artist's initials are ${getInitials(artist)}`;
      }
      return `The artist rhymes with ${await getMultiRhyme(artist)}`;
    });
  }

  function getYear() {
    return spotify(getPlaying).then(({ date }) => `This song was released in ${printYear(date)}`);
  }

  function printYear(date) {
    return new Date(date).getYear() + 1901;
  }

  function splitName(name) {
    return name.split(/[\s,-/\.]+/);
  }

  function getInitials(artist) {
    return splitName(artist).map(w => w[0]).join('');
  }

  function getRandomElement(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function getMultiRhyme(words) {
    return Promise
      .all(splitName(words).map(word => getRhyme(word)))
      .then(rhymes => rhymes.join(' '));
  }

  function getRhyme(word) {
    return new Promise((resolve, reject) => {
      rhyme(r => {
        const rhymes = r.rhyme(word);
        if (rhymes.length === 0) {
          reject({ name: 'custom', msg: 'nothing' });
        } else {
          resolve(getRandomElement(rhymes));
        }
      });
    });
  }

  function nextSong() {
    return spotify(playNextSong);
  }

  async function playNextSong() {
    const url = 'https://api.spotify.com/v1/me/player/next';
    await axios.post(url, {}, getHeaders());
    return 'Good luck';
  }

  function guess(name) {
    return spotify(getPlaying)
      .then(data => getGuessResponse(data, name));
  }

  function getGuessResponse(data, name) {
    if (matches(data.artist, name)
        || matches(data.album, name)
        || matches(data.song, name)) {
      return 'Yes';
    }
    return 'No';
  }

  function matches(actual, guess) {
    const result = fuzzy([actual]).get(guess);
    return result && result[0][0] > 0.85;
  }

  function spotify(request) {
    return request().catch(err => {
      if (err.name === 'custom') throw err;
      return refreshToken().then(_ => {
        return request().catch(err => {
          if (err.name === 'custom') throw err;
          console.error(err);
          throw { name: 'custom', msg: 'Unable to connect to Spotify' };
        });
      });
    });
  }

  function getHeaders() {
    const headers = {
      Authorization: `Bearer ${spotifyAccessToken}`,
      'Content-Type': 'application/json'
    };
    return { headers };
  }

  async function getPlaying() {
    const url = 'https://api.spotify.com/v1/me/player/currently-playing';
    const data = await axios.get(url, getHeaders()).then(({ data }) => {
      if (!data.item) throw { name: 'custom', msg: 'There is not a song currently playing.' };
      return {
        artistName: data.item.artists[0].name,
        artistId: data.item.artists[0].id,
        songName: data.item.name,
        songId: data.item.id,
        albumName: data.item.album.name,
        albumId: data.item.album.id,
      };
    });
    const related = await spotify(() => getRelatedArtists(data.artistId));
    const date = await spotify(() => getAlbumDate(data.albumId));
    return {
      artist: data.artistName,
      related,
      song: data.songName,
      album: data.albumName,
      date
    };
  }

  async function getAlbumDate(albumId) {
    const url = `https://api.spotify.com/v1/albums/${albumId}`;
    return axios.get(url, getHeaders()).then(({ data }) => {
      return data.release_date;
    });
  }

  async function getRelatedArtists(artistId) {
    const url = `https://api.spotify.com/v1/artists/${artistId}/related-artists`;
    return axios.get(url, getHeaders()).then(({ data }) => {
      return data.artists.map(artist => artist.name);
    });
  }

  function refreshToken() {
    console.log('REFRESHING TOKEN');
    const auth = new Buffer(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64');
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      headers: { Authorization: `Basic ${auth}` },
      form: {
        grant_type: 'refresh_token',
        refresh_token: existingGame.refreshToken
      },
      json: true
    };
    return new Promise((resolve, reject) => {
      request.post(authOptions, (error, response, body) => {
        if (!error && response.statusCode === 200) {
          spotifyAccessToken = body.access_token;
          existingGame.update({ accessToken: spotifyAccessToken });
          resolve();
        } else {
          reject(body);
        }
      });
    });
  }

  function _handle() {
    if (intent === 'Guess') {
      return guess(result.parameters.name);
    } else if (intent === 'Hint') {
      return hint();
    } else if (intent === 'Next') {
      return nextSong();
    } else if (intent === 'Year') {
      return getYear();
    }
    return "I don't understand";
  }

}

/**
 * GET /intent
 * Get the intent of the question.
 */
exports.getIntent = (req, res) => {
  const result = req.body.result;
  res.set('Content-Type', 'application/json');
  res.status(200);
  res.send({ speech: result, displayText: result });
};

exports.answerQuestion = (question, party, socketId) => {
  return getIntent(question, socketId)
    .then(result => handleIntent(result, party))
    .catch(err => {
      if (err.name === 'custom') {
        return err.msg;
      }
      console.error(err);
      return 'Something went wrong.';
    });
};
