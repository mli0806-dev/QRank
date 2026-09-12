const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { db, uniqueSuffix } = require('./helpers/testDb');
const auth = require('../backend/auth');

async function createTestUser() {
    const suffix = uniqueSuffix();
    const passwordHash = await bcrypt.hash('irrelevant-password', 4);
    const [result] = await db.query(
        "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'user')",
        [`test-auth-${suffix}`, `test-auth-${suffix}@example.com`, passwordHash]
    );
    return result.insertId;
}

test('auth session lifecycle', async (t) => {
    const createdUserIds = [];

    t.after(async () => {
        for (const userId of createdUserIds) {
            await db.query("DELETE FROM users WHERE id = ?", [userId]);
        }
    });

    await t.test('createSession returns a well-formed token and stores its hash', async () => {
        const userId = await createTestUser();
        createdUserIds.push(userId);

        const { token, expiresAt } = await auth.createSession(userId);

        assert.match(token, /^[0-9a-f]{64}$/);
        assert.ok(expiresAt instanceof Date);

        const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
        const [rows] = await db.query("SELECT token_hash FROM sessions WHERE user_id = ?", [userId]);

        assert.equal(rows.length, 1);
        assert.equal(rows[0].token_hash, expectedHash);
    });

    await t.test('getSessionUser resolves a valid token to the right user', async () => {
        const userId = await createTestUser();
        createdUserIds.push(userId);

        const { token } = await auth.createSession(userId);
        const user = await auth.getSessionUser({ signedCookies: { [auth.SESSION_COOKIE_NAME]: token } });

        assert.ok(user);
        assert.equal(user.id, userId);
        assert.equal(user.role, 'user');
    });

    await t.test('getSessionUser returns null for a bogus token', async () => {
        const user = await auth.getSessionUser({ signedCookies: { [auth.SESSION_COOKIE_NAME]: 'not-a-real-token' } });
        assert.equal(user, null);
    });

    await t.test('getSessionUser returns null for an expired session', async () => {
        const userId = await createTestUser();
        createdUserIds.push(userId);

        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiredDate = new Date(Date.now() - 60 * 1000);

        await db.query(
            "INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
            [userId, tokenHash, expiredDate]
        );

        const user = await auth.getSessionUser({ signedCookies: { [auth.SESSION_COOKIE_NAME]: token } });
        assert.equal(user, null);
    });

    await t.test('destroySession removes the session row', async () => {
        const userId = await createTestUser();
        createdUserIds.push(userId);

        const { token } = await auth.createSession(userId);
        await auth.destroySession(token);

        const user = await auth.getSessionUser({ signedCookies: { [auth.SESSION_COOKIE_NAME]: token } });
        assert.equal(user, null);
    });

    await t.test('destroyUserSessions removes every session for a user', async () => {
        const userId = await createTestUser();
        createdUserIds.push(userId);

        const first = await auth.createSession(userId);
        const second = await auth.createSession(userId);

        await auth.destroyUserSessions(userId);

        const [rows] = await db.query("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?", [userId]);
        assert.equal(rows[0].count, 0);

        assert.equal(await auth.getSessionUser({ signedCookies: { [auth.SESSION_COOKIE_NAME]: first.token } }), null);
        assert.equal(await auth.getSessionUser({ signedCookies: { [auth.SESSION_COOKIE_NAME]: second.token } }), null);
    });
});

test.after(async () => {
    await db.end();
});
