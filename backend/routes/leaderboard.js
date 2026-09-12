const express = require('express');
const db = require('../config/db');
const { publicReadLimiter } = require('../middleware/rateLimiters');
const { getLeaderboard } = require('../services/leaderboard');

const router = express.Router();

router.get("/api/leaderboard", publicReadLimiter, async (req, res) => {
    try {
        const rows = await getLeaderboard(db);
        const leaderboard = rows.map((row) => ({
            id: row.id,
            displayId: row.display_id,
            username: row.username,
            qscore: row.qscore,
            placement: row.placement
        }));
        res.json({ leaderboard });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load leaderboard." });
    }
});

module.exports = router;
