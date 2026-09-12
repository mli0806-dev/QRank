async function getLeaderboard(db, { limit = 50, offset = 0 } = {}) {
    const [rows] = await db.query(
        `SELECT id, username, qscore,
                RANK() OVER (ORDER BY qscore DESC) AS placement
         FROM users
         ORDER BY qscore DESC, id ASC
         LIMIT ? OFFSET ?`,
        [limit, offset]
    );
    return rows;
}

module.exports = { getLeaderboard };
