const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || "3306", 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : undefined,
        multipleStatements: true
    });

    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                checksum CHAR(64) NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY name (name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
        `);

        const [appliedRows] = await connection.query("SELECT name, checksum FROM schema_migrations");
        const applied = new Map(appliedRows.map(row => [row.name, row.checksum]));

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(file => file.endsWith('.sql'))
            .sort();

        let appliedCount = 0;

        for (const file of files) {
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
            const checksum = crypto.createHash('sha256').update(sql).digest('hex');

            if (applied.has(file)) {
                if (applied.get(file) !== checksum) {
                    console.warn(`Warning: ${file} was already applied but its contents changed on disk. Skipping it — add a new migration instead of editing an applied one.`);
                }
                continue;
            }

            console.log(`Applying ${file}...`);
            await connection.query(sql);
            await connection.query(
                "INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)",
                [file, checksum]
            );
            appliedCount += 1;
        }

        console.log(appliedCount > 0 ? `Applied ${appliedCount} migration(s).` : "Database is already up to date.");
    } finally {
        await connection.end();
    }
}

run().catch(err => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
});
