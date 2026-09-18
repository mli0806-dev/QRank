const express = require('express');
const auth = require('../auth');
const db = require('../config/db');
const { publicReadLimiter, publicWriteLimiter } = require('../middleware/rateLimiters');
const { splitTags, mergeTags, getCourseTagsForTopic } = require('../services/tags');

const router = express.Router();

router.get("/api/problem-sets/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM problem_sets");
        res.json({ count: rows[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch problem set count." });
    }
});

router.get("/api/problem-sets", publicReadLimiter, async (req, res) => {
    try {
        const searchTerm = String(req.query.search || "").trim();
        const courseFilter = String(req.query.course || "").trim();
        const topicFilter = String(req.query.topic || "").trim();
        const subtopicFilter = String(req.query.subtopic || "").trim();
        const conditions = [];
        const params = [];

        if (searchTerm) {
            conditions.push(`(
                LOWER(COALESCE(name, '')) LIKE ?
                OR LOWER(COALESCE(description, '')) LIKE ?
                OR LOWER(COALESCE(tags, '')) LIKE ?
            )`);
            const likeTerm = `%${searchTerm.toLowerCase()}%`;
            params.push(likeTerm, likeTerm, likeTerm);
        }

        if (courseFilter) {
            conditions.push("LOWER(COALESCE(course, '')) = ?");
            params.push(courseFilter.toLowerCase());
        }

        if (topicFilter) {
            conditions.push("LOWER(COALESCE(topic, '')) = ?");
            params.push(topicFilter.toLowerCase());
        }

        if (subtopicFilter) {
            conditions.push("LOWER(COALESCE(subtopic, '')) = ?");
            params.push(subtopicFilter.toLowerCase());
        }

        let query = `
            SELECT id, name, description, course, topic, subtopic, tags, calculator_allowed
            FROM problem_sets
        `;

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }

        query += ` ORDER BY name ASC`;

        const [rows] = await db.query(query, params);
        const normalizedRows = rows.map(row => ({
            ...row,
            tags: splitTags(row.tags),
            calculatorAllowed: Boolean(row.calculator_allowed)
        }));

        res.json(normalizedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Problem set lookup failed." });
    }
});

router.post("/api/problem-sets", auth.requireAdmin, async (req, res) => {
    try {
        const { name, description, course, topic, subtopic, tags, calculatorAllowed } = req.body || {};

        if (!name || !course || !topic) {
            return res.status(400).json({ message: "Name, course, and topic are required." });
        }

        const cleanName = String(name).trim();
        const cleanDescription = String(description || "").trim();
        const cleanCourse = String(course).trim();
        const cleanTopic = String(topic).trim();
        const cleanSubtopic = subtopic ? String(subtopic).trim() : null;
        const cleanCalculatorAllowed = calculatorAllowed ? 1 : 0;
        const manualTags = splitTags(tags);
        const courseTags = await getCourseTagsForTopic(db, cleanCourse, cleanTopic);
        const cleanTags = mergeTags(manualTags, courseTags);

        const [result] = await db.query(
            "INSERT INTO problem_sets (name, description, course, topic, subtopic, tags, calculator_allowed) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [cleanName, cleanDescription, cleanCourse, cleanTopic, cleanSubtopic, cleanTags, cleanCalculatorAllowed]
        );

        res.status(201).json({
            message: "Problem set created successfully.",
            problemSet: {
                id: result.insertId,
                name: cleanName,
                description: cleanDescription,
                course: cleanCourse,
                topic: cleanTopic,
                subtopic: cleanSubtopic,
                tags: cleanTags,
                calculatorAllowed: Boolean(cleanCalculatorAllowed)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Problem set creation failed." });
    }
});

router.get("/api/problem-sets/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [problemSetRows] = await db.query(
            "SELECT id, name, description, course, topic, subtopic, tags, calculator_allowed FROM problem_sets WHERE id = ? LIMIT 1",
            [id]
        );

        if (problemSetRows.length === 0) {
            return res.status(404).json({ message: "Problem set not found." });
        }

        const [problemRows] = await db.query(
            "SELECT id, position, type, prompt, choices, points, explanation FROM problems WHERE problem_set_id = ? ORDER BY position ASC, id ASC",
            [id]
        );

        const problemSet = problemSetRows[0];
        problemSet.tags = splitTags(problemSet.tags);
        problemSet.calculatorAllowed = Boolean(problemSet.calculator_allowed);

        res.json({
            problemSet,
            problems: problemRows.map(row => ({
                id: row.id,
                type: row.type,
                prompt: row.prompt,
                choices: row.choices,
                points: row.points,
                hasExplanation: Boolean(row.explanation)
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load problem set." });
    }
});

router.get("/api/problems/:id", publicReadLimiter, async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            "SELECT id, problem_set_id FROM problems WHERE id = ? LIMIT 1",
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Problem not found." });
        }

        res.json({ id: rows[0].id, problemSetId: rows[0].problem_set_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to look up problem." });
    }
});

router.post("/api/problem-sets/:id/check", publicWriteLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const submitted = (req.body && req.body.answers) || {};

        const [problemSetRows] = await db.query(
            "SELECT assessment_enabled FROM problem_sets WHERE id = ? LIMIT 1",
            [id]
        );

        if (problemSetRows.length === 0) {
            return res.status(404).json({ message: "Problem set not found or has no problems." });
        }

        const assessmentEnabled = Boolean(problemSetRows[0].assessment_enabled);

        const [problemRows] = await db.query(
            "SELECT id, type, answer, points, explanation FROM problems WHERE problem_set_id = ?",
            [id]
        );

        if (problemRows.length === 0) {
            return res.status(404).json({ message: "Problem set not found or has no problems." });
        }

        const results = {};
        const correctAnswers = {};
        const explanations = {};
        let correctCount = 0;
        const correctProblems = [];

        for (const problem of problemRows) {
            const submittedAnswer = String(submitted[problem.id] ?? "").trim();
            const acceptableAnswers = problem.type === "multiple_choice"
                ? [problem.answer.trim().toLowerCase()]
                : problem.answer.split(',').map(a => a.trim().toLowerCase());
            const isCorrect = acceptableAnswers.includes(submittedAnswer.toLowerCase()) && submittedAnswer !== "";

            results[problem.id] = isCorrect;
            correctAnswers[problem.id] = problem.answer;
            if (problem.explanation) {
                explanations[problem.id] = problem.explanation;
            }
            if (isCorrect) {
                correctCount += 1;
                correctProblems.push(problem);
            }
        }

        let pointsAwarded = 0;
        const viewer = await auth.getSessionUser(req);

        if (viewer && correctProblems.length > 0 && assessmentEnabled) {
            for (const problem of correctProblems) {
                if (!problem.points) {
                    continue;
                }

                const [completionResult] = await db.query(
                    "INSERT IGNORE INTO problem_completions (user_id, problem_id) VALUES (?, ?)",
                    [viewer.id, problem.id]
                );

                if (completionResult.affectedRows === 1) {
                    await db.query("UPDATE users SET qscore = qscore + ? WHERE id = ?", [problem.points, viewer.id]);
                    pointsAwarded += problem.points;
                }
            }
        }

        res.json({
            results,
            correctAnswers,
            explanations,
            correctCount,
            total: problemRows.length,
            pointsAwarded
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to check answers." });
    }
});

module.exports = router;
