const express = require('express');
const crypto = require('crypto');
const auth = require('../auth');
const validation = require('../validation');
const db = require('../config/db');
const { publicReadLimiter, publicWriteLimiter } = require('../middleware/rateLimiters');
const { insertProblemsIntoSet } = require('../services/problemInserter');

const router = express.Router();

router.get("/api/competitions", publicReadLimiter, async (req, res) => {
    try {
        const {year, month} = req.query;

        if (!year || !month) {
            return res.status(400).json({message: "Year and month are required."});
        }

        const calendarValidation = validation.calendarQuerySchema.safeParse({ year: String(year), month: String(month) });

        if (!calendarValidation.success) {
            return res.status(400).json({ message: "Invalid year or month." });
        }

        const startDateBoundary = `${year}-${month.padStart(2, '0')}-01`;
        const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
        const endDateBoundary = `${year}-${month.padStart(2, '0')}-${lastDay}`;

        const [rows] = await db.query(`
            SELECT id, title,
                DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
                DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
                TIME_FORMAT(start_time, '%i:%s') AS raw_start_time,
                TIME_FORMAT(start_time, '%l:%i:%p') AS start_time,
                TIME_FORMAT(end_time, '%l:%i:%p') AS end_time
            FROM competitions
            WHERE start_date <= ? AND end_date >= ? AND is_private = 0
        `, [endDateBoundary, startDateBoundary]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({message: "Database query failed."})
    }
});

router.get("/api/competitions/lookup", async (req, res) => {
    try {
        const code = String(req.query.code || "").trim();

        if (!code) {
            return res.status(400).json({ message: "A join code is required." });
        }

        const [rows] = await db.query(
            "SELECT id FROM competitions WHERE join_code = ? LIMIT 1",
            [code]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "No competition matches that code." });
        }

        res.json({ competitionId: rows[0].id, code });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Database query failed." });
    }
});

router.get("/api/competitions/:id", publicReadLimiter, async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT id, title, category, problem_set_id, is_private, join_code,
                DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
                DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
                TIME_FORMAT(start_time, '%l:%i:%p') AS start_time,
                TIME_FORMAT(end_time, '%l:%i:%p') AS end_time
            FROM competitions
            WHERE id = ?
            LIMIT 1
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ message: "Competition not found." });
        }

        const competition = rows[0];

        if (competition.is_private && competition.join_code !== String(req.query.code || "")) {
            return res.status(404).json({ message: "Competition not found." });
        }

        res.json({
            id: competition.id,
            title: competition.title,
            category: competition.category,
            startDate: competition.start_date,
            endDate: competition.end_date,
            startTime: competition.start_time,
            endTime: competition.end_time,
            problemSetId: competition.problem_set_id,
            isPrivate: Boolean(competition.is_private),
            joinCode: competition.join_code
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Database query failed." });
    }
});

router.post("/api/competitions", publicWriteLimiter, auth.requireVerified, async (req, res) => {
    const {
        title, category, startDate, endDate, startTime, endTime, isPrivate,
        problemSetName, problemSetDescription, problems
    } = req.body || {};

    if (!title || !startDate || !endDate || !startTime || !endTime || !Array.isArray(problems)) {
        return res.status(400).json({ message: "Title, start date, end date, start time, end time, and problems are required." });
    }

    const competitionValidation = validation.competitionCreateSchema.safeParse({ title, startDate, endDate, startTime, endTime });

    if (!competitionValidation.success) {
        return res.status(400).json({ message: competitionValidation.error.issues[0].message || "Invalid competition details." });
    }

    const validProblems = problems.filter(problem => problem && problem.prompt && problem.answer);

    if (validProblems.length === 0) {
        return res.status(400).json({ message: "At least one valid problem is required." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [problemSetResult] = await connection.query(
            "INSERT INTO problem_sets (name, description) VALUES (?, ?)",
            [String(problemSetName || title).trim(), String(problemSetDescription || "").trim()]
        );
        const problemSetId = problemSetResult.insertId;

        await insertProblemsIntoSet(connection, problemSetId, validProblems);

        const cleanIsPrivate = isPrivate ? 1 : 0;
        const joinCode = cleanIsPrivate ? crypto.randomBytes(6).toString('hex') : null;

        const [competitionResult] = await connection.query(
            "INSERT INTO competitions (title, category, start_date, end_date, start_time, end_time, problem_set_id, is_private, join_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                String(title).trim(),
                category ? String(category).trim() : null,
                startDate,
                endDate,
                startTime || null,
                endTime || null,
                problemSetId,
                cleanIsPrivate,
                joinCode
            ]
        );

        await connection.commit();

        res.status(201).json({
            message: "Competition created.",
            competitionId: competitionResult.insertId,
            problemSetId,
            isPrivate: Boolean(cleanIsPrivate),
            joinCode
        });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: "Failed to create competition." });
    } finally {
        connection.release();
    }
});

router.get("/api/saved-competitions", auth.requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT c.id, c.title, c.category, c.is_private, c.join_code,
                DATE_FORMAT(c.start_date, '%Y-%m-%d') AS start_date,
                DATE_FORMAT(c.end_date, '%Y-%m-%d') AS end_date,
                TIME_FORMAT(c.start_time, '%l:%i:%p') AS start_time,
                TIME_FORMAT(c.end_time, '%l:%i:%p') AS end_time
            FROM saved_competitions sc
            JOIN competitions c ON c.id = sc.competition_id
            WHERE sc.user_id = ?
            ORDER BY c.start_date ASC, c.start_time ASC
        `, [req.user.id]);

        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load saved competitions." });
    }
});

router.post("/api/competitions/:id/save", auth.requireAuth, async (req, res) => {
    try {
        const [competitionRows] = await db.query("SELECT id FROM competitions WHERE id = ? LIMIT 1", [req.params.id]);

        if (competitionRows.length === 0) {
            return res.status(404).json({ message: "Competition not found." });
        }

        await db.query(
            "INSERT IGNORE INTO saved_competitions (user_id, competition_id) VALUES (?, ?)",
            [req.user.id, req.params.id]
        );

        res.status(201).json({ message: "Competition saved." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to save competition." });
    }
});

router.delete("/api/competitions/:id/save", auth.requireAuth, async (req, res) => {
    try {
        await db.query(
            "DELETE FROM saved_competitions WHERE user_id = ? AND competition_id = ?",
            [req.user.id, req.params.id]
        );

        res.json({ message: "Competition unsaved." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to unsave competition." });
    }
});

module.exports = router;
