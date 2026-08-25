const crypto = require('crypto');
const db = require('./config/db');

const SESSION_COOKIE_NAME = 'qrank_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.query(
        "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
        [userId, hashToken(token), expiresAt]
    );

    return { token, expiresAt };
}

async function destroySession(token) {
    if (!token) {
        return;
    }

    await db.query("DELETE FROM sessions WHERE token_hash = ?", [hashToken(token)]);
}

async function destroyUserSessions(userId) {
    await db.query("DELETE FROM sessions WHERE user_id = ?", [userId]);
}

async function getSessionUser(req) {
    const token = req.signedCookies?.[SESSION_COOKIE_NAME];

    if (!token) {
        return null;
    }

    const [rows] = await db.query(
        `
        SELECT users.id, users.username, users.email, users.role
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > NOW()
        LIMIT 1
        `,
        [hashToken(token)]
    );

    return rows[0] || null;
}

async function requireAuth(req, res, next) {
    const user = await getSessionUser(req);

    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    req.user = user;
    next();
}

async function requireAdmin(req, res, next) {
    const user = await getSessionUser(req);

    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    if (user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized." });
    }

    req.user = user;
    next();
}

async function requireVerified(req, res, next) {
    const user = await getSessionUser(req);

    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    if (user.role !== "verified" && user.role !== "admin") {
        return res.status(403).json({ message: "Not authorized." });
    }

    req.user = user;
    next();
}

function setSessionCookie(res, token, expiresAt) {
    res.cookie(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        signed: true,
        expires: expiresAt
    });
}

function clearSessionCookie(res) {
    res.clearCookie(SESSION_COOKIE_NAME);
}

module.exports = {
    SESSION_COOKIE_NAME,
    createSession,
    destroySession,
    destroyUserSessions,
    getSessionUser,
    requireAuth,
    requireAdmin,
    requireVerified,
    setSessionCookie,
    clearSessionCookie
};
