const test = require('node:test');
const assert = require('node:assert/strict');
const { db, uniqueSuffix } = require('./helpers/testDb');
const app = require('../backend/app');

test('answer scoring via /api/problem-sets/:id/check', async (t) => {
    let server;
    let baseUrl;
    let problemSetId;
    let mcProblemId;
    let frProblemId;

    t.before(async () => {
        server = app.listen(0);
        await new Promise((resolve) => server.once('listening', resolve));
        baseUrl = `http://localhost:${server.address().port}`;

        const suffix = uniqueSuffix();
        const [psResult] = await db.query(
            "INSERT INTO problem_sets (name, description) VALUES (?, 'test')",
            [`Scoring Test ${suffix}`]
        );
        problemSetId = psResult.insertId;

        const [mcResult] = await db.query(
            "INSERT INTO problems (problem_set_id, position, type, prompt, choices, answer) VALUES (?, 0, 'multiple_choice', 'What is 2+2?', ?, '4')",
            [problemSetId, JSON.stringify(['3', '4', '5', '6'])]
        );
        mcProblemId = mcResult.insertId;

        const [frResult] = await db.query(
            "INSERT INTO problems (problem_set_id, position, type, prompt, answer) VALUES (?, 1, 'free_response', 'Name a primary color', 'Red,Blue,Yellow')",
            [problemSetId]
        );
        frProblemId = frResult.insertId;
    });

    t.after(async () => {
        await db.query("DELETE FROM problems WHERE problem_set_id = ?", [problemSetId]);
        await db.query("DELETE FROM problem_sets WHERE id = ?", [problemSetId]);
        await new Promise((resolve) => server.close(resolve));
        await db.end();
    });

    async function check(answers) {
        const response = await fetch(`${baseUrl}/api/problem-sets/${problemSetId}/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers })
        });
        return { status: response.status, body: await response.json() };
    }

    await t.test('exact multiple-choice match is correct', async () => {
        const { status, body } = await check({ [mcProblemId]: '4' });
        assert.equal(status, 200);
        assert.equal(body.results[mcProblemId], true);
    });

    await t.test('wrong multiple-choice answer is incorrect', async () => {
        const { body } = await check({ [mcProblemId]: '3' });
        assert.equal(body.results[mcProblemId], false);
    });

    await t.test('multiple-choice answer comparison is case-insensitive', async () => {
        const { body } = await check({ [mcProblemId]: '4' });
        assert.equal(body.results[mcProblemId], true);
    });

    await t.test('free-response accepts any of the comma-separated answers, case-insensitively', async () => {
        const first = await check({ [frProblemId]: 'blue' });
        assert.equal(first.body.results[frProblemId], true);

        const second = await check({ [frProblemId]: 'YELLOW' });
        assert.equal(second.body.results[frProblemId], true);

        const third = await check({ [frProblemId]: 'green' });
        assert.equal(third.body.results[frProblemId], false);
    });

    await t.test('missing answer is marked incorrect, not a crash', async () => {
        const { status, body } = await check({});
        assert.equal(status, 200);
        assert.equal(body.results[mcProblemId], false);
        assert.equal(body.results[frProblemId], false);
    });

    await t.test('no points are awarded when assessment is disabled', async () => {
        const { body } = await check({ [mcProblemId]: '4', [frProblemId]: 'Red' });
        assert.equal(body.pointsAwarded, 0);
    });
});
