const test = require('node:test');
const assert = require('node:assert/strict');
const { db, uniqueSuffix } = require('./helpers/testDb');
const app = require('../backend/app');

test('leaderboard placement', async (t) => {
    let server;
    let baseUrl;
    const userIds = [];

    async function createUser(qscore) {
        const suffix = uniqueSuffix();
        const [result] = await db.query(
            "INSERT INTO users (username, email, password_hash, qscore) VALUES (?, ?, 'x', ?)",
            [`test-lb-${suffix}`, `test-lb-${suffix}@example.com`, qscore]
        );
        userIds.push(result.insertId);
        return result.insertId;
    }

    t.before(async () => {
        server = app.listen(0);
        await new Promise((resolve) => server.once('listening', resolve));
        baseUrl = `http://localhost:${server.address().port}`;
    });

    t.after(async () => {
        for (const id of userIds) {
            await db.query("DELETE FROM users WHERE id = ?", [id]);
        }
        await new Promise((resolve) => server.close(resolve));
        await db.end();
    });

    await t.test('ranks users by qscore descending, with ties sharing a placement', async () => {
        const highId = await createUser(100);
        const tiedIdA = await createUser(50);
        const tiedIdB = await createUser(50);
        const lowId = await createUser(10);

        const response = await fetch(`${baseUrl}/api/leaderboard`);
        const body = await response.json();

        assert.equal(response.status, 200);

        const byId = new Map(body.leaderboard.map((row) => [row.id, row]));

        assert.equal(byId.get(highId).placement, 1);
        assert.equal(byId.get(tiedIdA).placement, byId.get(tiedIdB).placement);
        assert.equal(byId.get(lowId).placement, byId.get(tiedIdA).placement + 2);
        assert.equal(byId.get(highId).qscore, 100);
    });
});
