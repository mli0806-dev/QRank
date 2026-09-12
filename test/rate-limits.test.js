const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers/testDb');
const app = require('../backend/app');

test('rate limiting on public read endpoints', async (t) => {
    let server;
    let baseUrl;

    t.before(async () => {
        server = app.listen(0);
        await new Promise((resolve) => server.once('listening', resolve));
        baseUrl = `http://localhost:${server.address().port}`;
    });

    t.after(async () => {
        await new Promise((resolve) => server.close(resolve));
        await db.end();
    });

    await t.test('GET /api/tags is rate limited after 120 requests in the window', async () => {
        let lastStatus;

        for (let i = 0; i < 121; i += 1) {
            const response = await fetch(`${baseUrl}/api/tags`);
            lastStatus = response.status;
        }

        assert.equal(lastStatus, 429);
    });
});
