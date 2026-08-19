// Reusable sync: pushes local topics/subtopics/units content to a target
// database (e.g. production TiDB), using an upsert-by-id so it's always safe
// to re-run.
//
// Usage:
//   SYNC_TARGET_HOST=... SYNC_TARGET_PORT=4000 SYNC_TARGET_USER=... \
//   SYNC_TARGET_PASSWORD=... SYNC_TARGET_NAME=qrankdb SYNC_TARGET_SSL=true \
//   npm run sync-content
//
// Deliberately uses SYNC_TARGET_* names instead of the app's own DB_* names --
// exporting DB_HOST etc. in the same shell would also redirect the app's own
// local connection below to the target, silently syncing local-to-itself
// instead of local-to-target (this bit us once already).
const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const REQUIRED_TARGET_VARS = ['SYNC_TARGET_HOST', 'SYNC_TARGET_USER', 'SYNC_TARGET_PASSWORD', 'SYNC_TARGET_NAME'];
const missing = REQUIRED_TARGET_VARS.filter((name) => !process.env[name]);

if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    console.error('Usage: SYNC_TARGET_HOST=... SYNC_TARGET_PORT=... SYNC_TARGET_USER=... SYNC_TARGET_PASSWORD=... SYNC_TARGET_NAME=... SYNC_TARGET_SSL=true npm run sync-content');
    process.exit(1);
}

// Add a table here to bring it under the same sync/verify treatment.
// "columns" is what gets compared/copied; "conflictUpdate" is the subset
// written on a pre-existing id (everything except id itself).
const TABLES = {
    topics: {
        columns: ['id', 'name'],
        conflictUpdate: ['name']
    },
    subtopics: {
        columns: ['id', 'topic_id', 'name', 'tags'],
        conflictUpdate: ['topic_id', 'name', 'tags']
    },
    // Must stay after subtopics -- units.subtopic_id is a foreign key into it,
    // and TABLES is synced in insertion order.
    units: {
        columns: ['id', 'subtopic_id', 'name'],
        conflictUpdate: ['subtopic_id', 'name']
    }
};

async function syncTable(localConnection, targetConnection, tableName, config) {
    const { columns, conflictUpdate } = config;
    const [localRows] = await localConnection.query(`SELECT ${columns.join(', ')} FROM ${tableName} ORDER BY id`);

    const placeholders = columns.map(() => '?').join(', ');
    const updateClause = conflictUpdate.map((col) => `${col} = VALUES(${col})`).join(', ');
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updateClause}`;

    for (const row of localRows) {
        await targetConnection.query(sql, columns.map((col) => row[col]));
    }

    return localRows.length;
}

async function verifyTable(localConnection, targetConnection, tableName, columns) {
    const [localRows] = await localConnection.query(`SELECT ${columns.join(', ')} FROM ${tableName} ORDER BY id`);
    const [targetRows] = await targetConnection.query(`SELECT ${columns.join(', ')} FROM ${tableName} ORDER BY id`);

    const targetMap = new Map(targetRows.map((row) => [row.id, row]));
    let mismatches = 0;

    for (const row of localRows) {
        const targetRow = targetMap.get(row.id);
        const matches = targetRow && columns.every((col) => targetRow[col] === row[col]);
        if (!matches) {
            mismatches += 1;
            console.log(`  MISMATCH id=${row.id}:`, row, 'vs', targetRow);
        }
    }

    return mismatches;
}

async function run() {
    const localConnection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const targetConnection = await mysql.createConnection({
        host: process.env.SYNC_TARGET_HOST,
        port: parseInt(process.env.SYNC_TARGET_PORT || '3306', 10),
        user: process.env.SYNC_TARGET_USER,
        password: process.env.SYNC_TARGET_PASSWORD,
        database: process.env.SYNC_TARGET_NAME,
        ssl: process.env.SYNC_TARGET_SSL === 'true' ? { rejectUnauthorized: true } : undefined
    });

    console.log(`Syncing local (${localConnection.config.database}@${localConnection.config.host}) -> target (${targetConnection.config.database}@${targetConnection.config.host})\n`);

    try {
        for (const [tableName, config] of Object.entries(TABLES)) {
            const count = await syncTable(localConnection, targetConnection, tableName, config);
            console.log(`${tableName}: processed ${count} rows`);
        }

        console.log('\nVerifying...');
        let totalMismatches = 0;
        for (const [tableName, config] of Object.entries(TABLES)) {
            const mismatches = await verifyTable(localConnection, targetConnection, tableName, config.columns);
            totalMismatches += mismatches;
            console.log(`${tableName}: ${mismatches === 0 ? 'matches' : mismatches + ' mismatches'}`);
        }

        console.log(totalMismatches === 0 ? '\nAll content tables match target.' : '\nSome mismatches remain -- see above.');
    } finally {
        await localConnection.end();
        await targetConnection.end();
    }
}

run().catch((err) => {
    console.error('Sync failed:', err);
    process.exitCode = 1;
});
