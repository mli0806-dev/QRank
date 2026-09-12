const test = require('node:test');
const assert = require('node:assert/strict');
const { db, uniqueSuffix } = require('./helpers/testDb');
const app = require('../backend/app');
const { getLeaderboard } = require('../backend/services/leaderboard');

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

    await t.test('display_id is sequential and gapless regardless of gaps in the real id', async () => {
        const firstId = await createUser(5);
        const secondId = await createUser(5);

        const rows = await getLeaderboard(db, { limit: 1000 });
        const byId = new Map(rows.map((row) => [row.id, row]));

        const firstDisplayId = byId.get(firstId).display_id;
        const secondDisplayId = byId.get(secondId).display_id;

        assert.equal(typeof firstDisplayId, 'number');
        assert.equal(secondDisplayId, firstDisplayId + 1);
    });
});
