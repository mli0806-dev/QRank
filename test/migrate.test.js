const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./helpers/testDb');
const { run } = require('../database/migrate');

test('migration runner', async (t) => {
    t.after(async () => {
        await db.end();
    });

    await t.test('running migrations against an already-migrated database is a no-op', async () => {
        await run();
        await run();
    });

    await t.test('schema_migrations records the latest migration with a matching checksum', async () => {
        const migrationFile = '0017_add_explanation_to_problems.sql';
        const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
        const expectedChecksum = crypto.createHash('sha256').update(fs.readFileSync(migrationPath, 'utf8')).digest('hex');

        const [rows] = await db.query("SELECT checksum FROM schema_migrations WHERE name = ?", [migrationFile]);

        assert.equal(rows.length, 1);
        assert.equal(rows[0].checksum, expectedChecksum);
    });

    await t.test('running migrations concurrently does not race', async () => {
        const results = await Promise.allSettled([run(), run()]);
        const rejected = results.filter((result) => result.status === 'rejected');

        assert.ok(rejected.length <= 1, 'at most one concurrent run should fail, not both');
    });
});
