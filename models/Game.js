const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  name: { type: String, unique: true },
  //password: String,
  players: [mongoose.Schema.Types.Mixed],
  chat: [mongoose.Schema.Types.Mixed],
  accessToken: String,
  refreshToken: String
}, { timestamps: true });

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
