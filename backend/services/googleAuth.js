const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const env = require('../env');
const db = require('../config/db');

const googleAuthClient = new OAuth2Client();

const MAX_USERNAME_LENGTH = 16;

function buildGoogleUsername(seedName) {
    return String(seedName || "user")
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "")
        .slice(0, MAX_USERNAME_LENGTH) || "user";
}

async function getUniqueUsername(seedName) {
    const base = buildGoogleUsername(seedName);

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const suffix = attempt === 0 ? "" : String(crypto.randomInt(1000, 9999));
        const username = suffix ? `${base.slice(0, MAX_USERNAME_LENGTH - suffix.length)}${suffix}` : base;
        const [rows] = await db.query(
            "SELECT id FROM users WHERE username = ? LIMIT 1",
            [username]
        );

        if (rows.length === 0) {
            return username;
        }
    }

    const suffix = String(crypto.randomInt(100000, 999999));
    return `${base.slice(0, MAX_USERNAME_LENGTH - suffix.length)}${suffix}`;
}

async function verifyGoogleCredential(credential) {
    if (!env.googleClientId) {
        throw new Error("Google sign-in is not configured.");
    }

    const ticket = await googleAuthClient.verifyIdToken({
        idToken: credential,
        audience: env.googleClientId
    });

    const profile = ticket.getPayload();

    if (!profile || String(profile.email_verified).toLowerCase() !== "true") {
        throw new Error("Google email is not verified.");
    }

    if (!profile.email || !profile.sub) {
        throw new Error("Google profile is incomplete.");
    }

    return profile;
}

module.exports = { buildGoogleUsername, getUniqueUsername, verifyGoogleCredential };
