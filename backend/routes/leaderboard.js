const express = require('express');
const db = require('../config/db');
const { publicReadLimiter } = require('../middleware/rateLimiters');
const { getLeaderboard } = require('../services/leaderboard');

const router = express.Router();

router.get("/api/leaderboard", publicReadLimiter, async (req, res) => {
    try {
        const leaderboard = await getLeaderboard(db);
        res.json({ leaderboard });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load leaderboard." });
    }
});

module.exports = router;
