const test = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers/testDb');
const app = require('../backend/app');

test('security headers', async (t) => {
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

    await t.test('response includes the expected security headers', async () => {
        const response = await fetch(`${baseUrl}/`);
        const headers = response.headers;

        assert.match(headers.get('content-security-policy'), /script-src[^;]*'unsafe-eval'/);
        assert.match(headers.get('content-security-policy'), /style-src[^;]*https:\/\/accounts\.google\.com/);
        assert.equal(headers.get('x-frame-options'), 'SAMEORIGIN');
        assert.equal(headers.get('x-content-type-options'), 'nosniff');
        assert.equal(headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
        assert.equal(headers.get('strict-transport-security'), 'max-age=63072000; includeSubDomains');
        assert.equal(headers.get('cross-origin-opener-policy'), 'same-origin');
        assert.equal(headers.get('cross-origin-resource-policy'), 'same-site');
        assert.ok(headers.get('permissions-policy').includes('camera=()'));
        assert.equal(headers.get('x-powered-by'), null);
    });
});
