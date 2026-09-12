const bcrypt = require('bcrypt');
const crypto = require('crypto');

const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

module.exports = { dummyPasswordHash };
