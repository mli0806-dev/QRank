const crypto = require('crypto');
const db = require('../../backend/config/db');

function uniqueSuffix() {
    return crypto.randomBytes(6).toString('hex');
}

module.exports = { db, uniqueSuffix };
