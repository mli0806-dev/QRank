const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MAX_USERNAME_LENGTH = 16;
const VALID_USERNAME = /^[a-zA-Z0-9._-]+$/;

function sanitizeUsername(raw) {
    const stripped = String(raw).replace(/[^a-zA-Z0-9._-]/g, '');
    return stripped.slice(0, MAX_USERNAME_LENGTH) || 'user';
}

function withSuffix(base, suffix) {
    const suffixStr = String(suffix);
    return `${base.slice(0, MAX_USERNAME_LENGTH - suffixStr.length)}${suffixStr}`;
}

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined
    });

    try {
        const [rows] = await connection.query("SELECT id, username FROM users ORDER BY id");
        const takenUsernames = new Set(rows.map((row) => row.username));
        const updates = [];

        for (const row of rows) {
            const isCompliant = row.username.length <= MAX_USERNAME_LENGTH && VALID_USERNAME.test(row.username);

            if (isCompliant) {
                continue;
            }

            takenUsernames.delete(row.username);

            const base = sanitizeUsername(row.username);
            let candidate = base;
            let suffix = 1;

            while (takenUsernames.has(candidate)) {
                suffix += 1;
                candidate = withSuffix(base, suffix);
            }

            takenUsernames.add(candidate);
            updates.push({ id: row.id, oldUsername: row.username, newUsername: candidate });
        }

        if (updates.length === 0) {
            console.log('All usernames already comply with the 16-character letters/numbers/periods/hyphens/underscores rule.');
            return;
        }

        console.log(`Updating ${updates.length} username(s):`);
        for (const update of updates) {
            console.log(`  #${update.id}: "${update.oldUsername}" -> "${update.newUsername}"`);
            await connection.query("UPDATE users SET username = ? WHERE id = ?", [update.newUsername, update.id]);
        }

        console.log('Done.');
    } finally {
        await connection.end();
    }
}

run().catch((err) => {
    console.error('Username normalization failed:', err);
    process.exitCode = 1;
});
