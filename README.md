# QRank

Math problem sets, timed competitions, QScore rankings. Backend is one Express app talking to MySQL/TiDB. Frontend is plain static HTML/CSS/JS, no build step.

## Setup

- Node 24.x
- A local MySQL-compatible server

```bash
npm install
cp .env.example .env
# fill in your local DB credentials
```

```sql
CREATE DATABASE qrankdb;
```

```bash
npm run migrate
npm start
```

Runs on `http://localhost:3000` by default.

## Environment variables

Full list with placeholders in `.env.example`. Notes on a few:

- `COOKIE_SECRET`, `CRON_SECRET` are required — the app won't start without them.
- `GOOGLE_CLIENT_ID`, `DESMOS_API_KEY` are optional. Without them, Google login and the Desmos tool just don't show up.
- `SMTP_*` is optional. No SMTP config means password reset emails get skipped (falls back to `DEV_PASSWORD_RESET_FALLBACK`).
- `SYNC_TARGET_*` is only used by `database/sync-content.js`, not the app itself.

## Testing

Uses `node:test` against a real local `qrank_test` database, not mocks — one of the tests runs actual migrations.

```bash
CREATE DATABASE qrank_test;
cp .env.test.example .env.test
# fill in your local DB credentials
npm test
```

`pretest` runs migrations against `qrank_test` first. Don't point `.env.test` at anything shared or production — tests create and delete real rows.

## Lint / format

```bash
npm run lint
npm run format
```

Formatting isn't applied repo-wide, only run it on files you're already touching.

`no-undef` is a hard error everywhere, including the frontend — the frontend uses real ES modules now, so a missing import is a real bug, not a known gap.

## Backend structure

`backend/app.js` just wires everything together (helmet, static files, routers). Everything else lives in:

- `backend/routes/` — one file per feature area (auth, problem sets, suggestions, competitions, users, topics, leaderboard, misc). Each exports an Express router.
- `backend/services/` — shared logic used by more than one route (tag parsing, inserting problems into a set, shaping a user for a response, Google token verification, mailer, leaderboard query).
- `backend/middleware/rateLimiters.js` — the four rate limiters, shared across routers.
- `backend/env.js` — loads `.env` once, checks required vars are present, exports everything as one object. Fails fast on startup if `DB_*`, `COOKIE_SECRET`, or `CRON_SECRET` are missing.
- `backend/config/db.js` — the MySQL connection pool, unchanged.

Adding a new endpoint means picking the right `routes/` file (or adding one) and requiring whatever it needs from `services/`. Don't put business logic directly in `app.js`.

## Frontend structure

No build step, no bundler — the frontend ships as plain static files, but it's real native ES modules (`<script type="module">`, `import`/`export`), not a pile of globals from one shared file.

- `frontend/js/core/` — the stuff every page needs: header/footer injection, dark mode, DOM/markdown helpers, auth state, the markdown toolbar, and `page-init.js`'s `initCorePage()`, which every page's entry script calls first.
- `frontend/js/topics/`, `frontend/js/problem-sets/` — the topic catalog + network map, and problem-set search/cards.
- `frontend/js/{profile,contribute,desmos,rankings}.js` — one file per page-level feature.
- `frontend/js/entry-*.js` — one tiny entry script per HTML page. Each imports `initCorePage` plus whatever that specific page needs and calls them. This is what each page's `<script type="module">` tag points at — there's no shared router guessing the page from the URL anymore.
- Per-page scripts (`problems/detail.js`, `competitions/*.js`, `login/auth.js`, `review/review.js`) import from `frontend/js/` the same way — e.g. `competitions/add.js` imports `addProblemItem`/`serializeProblemItems` straight from `frontend/js/contribute.js`.

Adding a new page: give it its own `entry-*.js` that imports `initCorePage` and calls whatever it needs, and point its `<script type="module">` tag at that file.

## Migrations

Live in `database/migrations/`, run in filename order, tracked in `schema_migrations` with a checksum per file.

- Don't edit a migration that's already applied anywhere. The runner warns and skips instead of re-running it — add a new migration instead.
- Forward-only, no rollback.
- Safe to run `npm run migrate` repeatedly.

## `database/sync-content.js`

Copies `topics`/`subtopics`/`units` from your local DB to prod, using `SYNC_TARGET_*` (kept separate from `DB_*` on purpose, so you can't accidentally sync local-to-local). Run manually when reference data changes.

## Security notes

CSP allows `unsafe-eval` in `script-src`. This is required — the Desmos calculator breaks without it (confirmed by testing: throws a CSP violation and fails to load). Nothing else in the app needs eval. If you want to try removing it again, test with the Desmos "Insert graph" tool before assuming it's safe.

## Known gaps

- An old commit leaked a Vercel token into git history. It's a short-lived (~12hr) token and long expired, so we're leaving history alone instead of rewriting it.
- `frontend/topics-react/` and `frontend-react/` are gone — an unused React rewrite of the topics page that never got wired up. The real topics page is the vanilla JS one in `frontend/js/topics/catalog.js`.
