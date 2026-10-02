const express = require('express');
const auth = require('../auth');
const db = require('../config/db');
const { publicReadLimiter, publicWriteLimiter } = require('../middleware/rateLimiters');
const { splitTags, mergeTags, getCourseTagsForTopic } = require('../services/tags');

const router = express.Router();

function cleanTimeLimitMinutes(timeLimitMinutes) {
    const parsed = Math.trunc(Number(timeLimitMinutes));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function startOrResumeTimer(viewer, problemSetId, timeLimitMinutes) {
    const totalSeconds = timeLimitMinutes * 60;

    if (!viewer) {
        return totalSeconds;
    }

    await db.query(
        "INSERT IGNORE INTO problem_set_timers (user_id, problem_set_id) VALUES (?, ?)",
        [viewer.id, problemSetId]
    );

    const [rows] = await db.query(
        "SELECT TIMESTAMPDIFF(SECOND, started_at, NOW()) AS elapsed FROM problem_set_timers WHERE user_id = ? AND problem_set_id = ? LIMIT 1",
        [viewer.id, problemSetId]
    );

    return Math.max(0, totalSeconds - Number(rows[0]?.elapsed ?? 0));
}

router.get("/api/problem-sets/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM problem_sets WHERE is_public = 1");
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
        const viewer = await auth.getSessionUser(req);
        const conditions = [];
        const params = [];

        if (viewer) {
            conditions.push("(is_public = 1 OR created_by = ?)");
            params.push(viewer.id);
        } else {
            conditions.push("is_public = 1");
        }

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
            SELECT id, name, description, course, topic, subtopic, tags, calculator_allowed, is_public, created_by
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
            calculatorAllowed: Boolean(row.calculator_allowed),
            isPublic: Boolean(row.is_public)
        }));

        res.json(normalizedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Problem set lookup failed." });
    }
});

router.post("/api/problem-sets", auth.requireAdmin, async (req, res) => {
    try {
        const { name, description, course, topic, subtopic, tags, calculatorAllowed, isPublic, timeLimitMinutes } = req.body || {};

        if (!name || !course || !topic) {
            return res.status(400).json({ message: "Name, course, and topic are required." });
        }

        const cleanName = String(name).trim();
        const cleanDescription = String(description || "").trim();
        const cleanCourse = String(course).trim();
        const cleanTopic = String(topic).trim();
        const cleanSubtopic = subtopic ? String(subtopic).trim() : null;
        const cleanCalculatorAllowed = calculatorAllowed ? 1 : 0;
        const cleanIsPublic = isPublic === false ? 0 : 1;
        const cleanedTimeLimitMinutes = cleanTimeLimitMinutes(timeLimitMinutes);
        const manualTags = splitTags(tags);
        const courseTags = await getCourseTagsForTopic(db, cleanCourse, cleanTopic);
        const cleanTags = mergeTags(manualTags, courseTags);

        const [result] = await db.query(
            "INSERT INTO problem_sets (name, description, course, topic, subtopic, tags, calculator_allowed, is_public, created_by, time_limit_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [cleanName, cleanDescription, cleanCourse, cleanTopic, cleanSubtopic, cleanTags, cleanCalculatorAllowed, cleanIsPublic, req.user.id, cleanedTimeLimitMinutes]
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
                calculatorAllowed: Boolean(cleanCalculatorAllowed),
                isPublic: Boolean(cleanIsPublic),
                timeLimitMinutes: cleanedTimeLimitMinutes
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Problem set creation failed." });
    }
});

router.get("/api/problem-sets/in-progress", auth.requireAuth, async (req, res) => {
    try {
        const [rows] = await db.query(
            `
            SELECT ps.id, ps.name, ps.description, ps.course, ps.topic, ps.subtopic, ps.tags, ps.calculator_allowed,
                   COUNT(p.id) AS total_problems,
                   COUNT(pa.id) AS attempted_problems,
                   COUNT(CASE WHEN pa.is_correct = 1 THEN 1 END) AS correct_problems
            FROM problem_sets ps
            JOIN problems p ON p.problem_set_id = ps.id
            LEFT JOIN problem_attempts pa ON pa.problem_id = p.id AND pa.user_id = ?
            GROUP BY ps.id
            HAVING attempted_problems > 0 AND attempted_problems < total_problems
            ORDER BY ps.name ASC
            `,
            [req.user.id]
        );

        const problemSets = rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            course: row.course,
            topic: row.topic,
            subtopic: row.subtopic,
            tags: splitTags(row.tags),
            calculatorAllowed: Boolean(row.calculator_allowed),
            totalProblems: row.total_problems,
            attemptedProblems: row.attempted_problems,
            correctProblems: row.correct_problems
        }));

        res.json({ problemSets });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load in-progress problem sets." });
    }
});

router.get("/api/problem-sets/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [problemSetRows] = await db.query(
            "SELECT id, name, description, course, topic, subtopic, tags, calculator_allowed, is_public, created_by, time_limit_minutes FROM problem_sets WHERE id = ? LIMIT 1",
            [id]
        );

        if (problemSetRows.length === 0) {
            return res.status(404).json({ message: "Problem set not found." });
        }

        const problemSet = problemSetRows[0];
        const viewer = await auth.getSessionUser(req);
        const isOwner = Boolean(viewer && viewer.id === problemSet.created_by);
        const isAdmin = Boolean(viewer && viewer.role === "admin");

        if (!problemSet.is_public && !isOwner && !isAdmin) {
            return res.status(404).json({ message: "Problem set not found." });
        }

        const [problemRows] = await db.query(
            "SELECT id, position, type, prompt, choices, answer, points, explanation FROM problems WHERE problem_set_id = ? ORDER BY position ASC, id ASC",
            [id]
        );

        problemSet.tags = splitTags(problemSet.tags);
        problemSet.calculatorAllowed = Boolean(problemSet.calculator_allowed);
        problemSet.isPublic = Boolean(problemSet.is_public);
        problemSet.isOwner = isOwner;
        problemSet.timeLimitMinutes = problemSet.time_limit_minutes;
        problemSet.timeRemainingSeconds = problemSet.time_limit_minutes
            ? await startOrResumeTimer(viewer, problemSet.id, problemSet.time_limit_minutes)
            : null;

        const priorAttemptsByProblemId = new Map();

        if (viewer && problemRows.length > 0) {
            const [attemptRows] = await db.query(
                "SELECT problem_id, is_correct, submitted_answer FROM problem_attempts WHERE user_id = ? AND problem_id IN (?)",
                [viewer.id, problemRows.map((row) => row.id)]
            );
            attemptRows.forEach((row) => priorAttemptsByProblemId.set(row.problem_id, row));
        }

        res.json({
            problemSet,
            problems: problemRows.map(row => {
                const priorAttempt = priorAttemptsByProblemId.get(row.id);

                return {
                    id: row.id,
                    type: row.type,
                    prompt: row.prompt,
                    choices: row.choices,
                    points: row.points,
                    hasExplanation: Boolean(row.explanation),
                    priorAnswer: priorAttempt ? priorAttempt.submitted_answer : null,
                    priorIsCorrect: priorAttempt ? Boolean(priorAttempt.is_correct) : null,
                    priorCorrectAnswer: priorAttempt ? row.answer : null,
                    priorExplanation: priorAttempt && row.explanation ? row.explanation : null
                };
            })
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
            "SELECT assessment_enabled, is_public, created_by FROM problem_sets WHERE id = ? LIMIT 1",
            [id]
        );

        if (problemSetRows.length === 0) {
            return res.status(404).json({ message: "Problem set not found or has no problems." });
        }

        const viewer = await auth.getSessionUser(req);
        const isOwner = Boolean(viewer && viewer.id === problemSetRows[0].created_by);
        const isAdmin = Boolean(viewer && viewer.role === "admin");

        if (!problemSetRows[0].is_public && !isOwner && !isAdmin) {
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

        const submittedIds = new Set(Object.keys(submitted).map(Number));

        const lockedAttempts = new Map();

        if (viewer && submittedIds.size > 0) {
            const [priorRows] = await db.query(
                "SELECT problem_id, is_correct FROM problem_attempts WHERE user_id = ? AND problem_id IN (?)",
                [viewer.id, [...submittedIds]]
            );
            priorRows.forEach((row) => lockedAttempts.set(row.problem_id, row));
        }

        const results = {};
        const correctAnswers = {};
        const explanations = {};
        let correctCount = 0;
        const correctProblems = [];

        for (const problem of problemRows) {
            if (!submittedIds.has(problem.id)) {
                continue;
            }

            const priorAttempt = lockedAttempts.get(problem.id);

            if (priorAttempt) {
                results[problem.id] = Boolean(priorAttempt.is_correct);
                correctAnswers[problem.id] = problem.answer;
                if (problem.explanation) {
                    explanations[problem.id] = problem.explanation;
                }
                if (priorAttempt.is_correct) {
                    correctCount += 1;
                }
                continue;
            }

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

        if (viewer) {
            for (const problem of problemRows) {
                if (lockedAttempts.has(problem.id)) {
                    continue;
                }

                const submittedAnswer = String(submitted[problem.id] ?? "").trim();

                if (submittedAnswer === "") {
                    continue;
                }

                await db.query(
                    "INSERT INTO problem_attempts (user_id, problem_id, is_correct, submitted_answer) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE is_correct = VALUES(is_correct), submitted_answer = VALUES(submitted_answer), updated_at = CURRENT_TIMESTAMP",
                    [viewer.id, problem.id, results[problem.id] ? 1 : 0, submittedAnswer]
                );
            }
        }

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

router.post("/api/problem-sets/:id/reset", auth.requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            "DELETE pa FROM problem_attempts pa JOIN problems p ON p.id = pa.problem_id WHERE p.problem_set_id = ? AND pa.user_id = ?",
            [id, req.user.id]
        );

        await db.query(
            "DELETE FROM problem_set_timers WHERE problem_set_id = ? AND user_id = ?",
            [id, req.user.id]
        );

        res.json({ message: "Progress reset." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to reset progress." });
    }
});

module.exports = router;
