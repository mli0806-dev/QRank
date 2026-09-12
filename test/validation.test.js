const test = require('node:test');
const assert = require('node:assert/strict');
const validation = require('../backend/validation');

test('registerSchema', () => {
    assert.equal(validation.registerSchema.safeParse({ username: 'valid_user1', email: 'a@b.com', password: 'password123' }).success, true);
    assert.equal(validation.registerSchema.safeParse({ username: 'ab', email: 'a@b.com', password: 'password123' }).success, false);
    assert.equal(validation.registerSchema.safeParse({ username: 'has spaces', email: 'a@b.com', password: 'password123' }).success, false);
    assert.equal(validation.registerSchema.safeParse({ username: 'valid_user1', email: 'not-an-email', password: 'password123' }).success, false);
    assert.equal(validation.registerSchema.safeParse({ username: 'valid_user1', email: 'a@b.com', password: 'short' }).success, false);
    assert.equal(validation.registerSchema.safeParse({ username: 'valid_user1', email: 'a@b.com', password: 'x'.repeat(129) }).success, false);
});

test('loginSchema', () => {
    assert.equal(validation.loginSchema.safeParse({ email: 'a@b.com', password: 'anything' }).success, true);
    assert.equal(validation.loginSchema.safeParse({ email: 'not-an-email', password: 'anything' }).success, false);
    assert.equal(validation.loginSchema.safeParse({ email: 'a@b.com', password: '' }).success, false);
});

test('competitionCreateSchema', () => {
    const valid = { title: 'Test Cup', startDate: '2026-01-01', endDate: '2026-01-02', startTime: '09:00', endTime: '17:30' };
    assert.equal(validation.competitionCreateSchema.safeParse(valid).success, true);
    assert.equal(validation.competitionCreateSchema.safeParse({ ...valid, startDate: '01/01/2026' }).success, false);
    assert.equal(validation.competitionCreateSchema.safeParse({ ...valid, startTime: '9:00' }).success, false);
    assert.equal(validation.competitionCreateSchema.safeParse({ ...valid, startTime: '25:00' }).success, false);
    assert.equal(validation.competitionCreateSchema.safeParse({ ...valid, title: '' }).success, false);
});

test('calendarQuerySchema', () => {
    assert.equal(validation.calendarQuerySchema.safeParse({ year: '2026', month: '6' }).success, true);
    assert.equal(validation.calendarQuerySchema.safeParse({ year: '2026', month: '12' }).success, true);
    assert.equal(validation.calendarQuerySchema.safeParse({ year: 'abcd', month: '6' }).success, false);
    assert.equal(validation.calendarQuerySchema.safeParse({ year: '2026', month: '13' }).success, false);
    assert.equal(validation.calendarQuerySchema.safeParse({ year: '2026', month: '0' }).success, false);
});

test('validateSuggestionProblemsPayload', () => {
    const validProblems = JSON.stringify([
        { type: 'multiple_choice', prompt: 'What is 2+2?', choices: ['3', '4'], answer: '4', points: 1 }
    ]);
    assert.equal(validation.validateSuggestionProblemsPayload(validProblems).success, true);

    assert.equal(validation.validateSuggestionProblemsPayload('not json').success, false);
    assert.equal(validation.validateSuggestionProblemsPayload(JSON.stringify([])).success, false);
    assert.equal(validation.validateSuggestionProblemsPayload(JSON.stringify([{ type: 'multiple_choice' }])).success, false);

    const oversized = JSON.stringify([{ type: 'free_response', prompt: 'x'.repeat(60000), answer: 'y' }]);
    assert.equal(validation.validateSuggestionProblemsPayload(oversized).success, false);

    const tooManyProblems = JSON.stringify(
        Array.from({ length: 101 }, () => ({ type: 'free_response', prompt: 'p', answer: 'a' }))
    );
    assert.equal(validation.validateSuggestionProblemsPayload(tooManyProblems).success, false);
});
