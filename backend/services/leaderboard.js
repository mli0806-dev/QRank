async function getLeaderboard(db, { limit = 50, offset = 0 } = {}) {
    const [rows] = await db.query(
        `SELECT u.id, u.username, u.qscore,
                (SELECT COUNT(*) FROM users u2 WHERE u2.id <= u.id) AS display_id,
                RANK() OVER (ORDER BY u.qscore DESC) AS placement
         FROM users u
         ORDER BY u.qscore DESC, u.id ASC
         LIMIT ? OFFSET ?`,
        [limit, offset]
    );
    return rows;
}

module.exports = { getLeaderboard };
