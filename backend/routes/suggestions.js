const express = require('express');
const auth = require('../auth');
const validation = require('../validation');
const db = require('../config/db');
const { publicWriteLimiter } = require('../middleware/rateLimiters');
const { splitTags, mergeTags, getCourseTagsForSubtopic } = require('../services/tags');
const { insertProblemsIntoSet } = require('../services/problemInserter');

const router = express.Router();

function mapSuggestionRow(row) {
    let parsedProblems;
    try {
        parsedProblems = JSON.parse(row.problems);
    } catch (err) {
        parsedProblems = [];
    }

    return {
        id: row.id,
        name: row.name,
        description: row.description,
        topic: row.topic,
        subtopic: row.subtopic,
        unit: row.unit,
        tags: splitTags(row.tags),
        problems: parsedProblems,
        submitter: row.submitter,
        status: row.status,
        createdAt: row.created_at,
        createdProblemSetId: row.created_problem_set_id,
        editingProblemSetId: row.editing_problem_set_id,
        calculatorAllowed: Boolean(row.calculator_allowed),
        assessmentEnabled: Boolean(row.assessment_enabled)
    };
}

const SUGGESTION_COLUMNS = "id, name, description, topic, subtopic, unit, tags, problems, submitter, status, created_at, created_problem_set_id, editing_problem_set_id, calculator_allowed, assessment_enabled";

router.post("/api/problem-set-suggestions", publicWriteLimiter, auth.requireAuth, async (req, res) => {
    try {
        const { name, description, topic, subtopic, unit, tags, problems, calculatorAllowed, assessmentEnabled } = req.body || {};

        if (!name || !topic || !subtopic || !problems) {
            return res.status(400).json({ message: "Name, topic, subtopic, and problems are required." });
        }

        const problemsValidation = validation.validateSuggestionProblemsPayload(problems);

        if (!problemsValidation.success) {
            return res.status(400).json({ message: problemsValidation.message });
        }

        const cleanName = String(name).trim();
        const cleanDescription = String(description || "").trim();
        const cleanTopic = String(topic).trim();
        const cleanSubtopic = String(subtopic).trim();
        const cleanUnit = unit ? String(unit).trim() : null;
        const cleanTags = splitTags(tags).join(',');
        const cleanProblems = String(problems).trim();
        const cleanSubmitter = req.user.username;
        const cleanCalculatorAllowed = calculatorAllowed ? 1 : 0;
        const cleanAssessmentEnabled = assessmentEnabled && req.user.role === "admin" ? 1 : 0;

        const [result] = await db.query(
            "INSERT INTO problem_set_suggestions (name, description, topic, subtopic, unit, tags, problems, submitter, calculator_allowed, assessment_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [cleanName, cleanDescription, cleanTopic, cleanSubtopic, cleanUnit, cleanTags, cleanProblems, cleanSubmitter, cleanCalculatorAllowed, cleanAssessmentEnabled]
        );

        res.status(201).json({
            message: "Your suggestion has been received and is pending review.",
            suggestionId: result.insertId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to submit suggestion." });
    }
});

router.get("/api/admin/problem-set-suggestions", auth.requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ${SUGGESTION_COLUMNS} FROM problem_set_suggestions ORDER BY created_at DESC`
        );

        res.json({ suggestions: rows.map(mapSuggestionRow) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load suggestions." });
    }
});

router.get("/api/admin/problem-set-suggestions/:id", auth.requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT ${SUGGESTION_COLUMNS} FROM problem_set_suggestions WHERE id = ? LIMIT 1`,
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "Suggestion not found." });
        }

        res.json({ suggestion: mapSuggestionRow(rows[0]) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load suggestion." });
    }
});

router.put("/api/admin/problem-set-suggestions/:id", auth.requireAdmin, async (req, res) => {
    try {
        const { name, description, topic, subtopic, unit, tags, problems, calculatorAllowed, assessmentEnabled } = req.body || {};

        if (!name || !topic || !subtopic || !problems) {
            return res.status(400).json({ message: "Name, topic, subtopic, and problems are required." });
        }

        const problemsValidation = validation.validateSuggestionProblemsPayload(problems);

        if (!problemsValidation.success) {
            return res.status(400).json({ message: problemsValidation.message });
        }

        const cleanTags = splitTags(tags).join(',');
        const cleanUnit = unit ? String(unit).trim() : null;
        const cleanCalculatorAllowed = calculatorAllowed ? 1 : 0;
        const cleanAssessmentEnabled = assessmentEnabled ? 1 : 0;

        const [result] = await db.query(
            "UPDATE problem_set_suggestions SET name = ?, description = ?, topic = ?, subtopic = ?, unit = ?, tags = ?, problems = ?, calculator_allowed = ?, assessment_enabled = ? WHERE id = ?",
            [String(name).trim(), String(description || "").trim(), String(topic).trim(), String(subtopic).trim(), cleanUnit, cleanTags, String(problems).trim(), cleanCalculatorAllowed, cleanAssessmentEnabled, req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Suggestion not found." });
        }

        res.json({ message: "Suggestion updated." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to update suggestion." });
    }
});

router.post("/api/admin/problem-sets/:id/edit", auth.requireAdmin, async (req, res) => {
    try {
        const [problemSetRows] = await db.query(
            "SELECT id, name, description, topic, subtopic, unit, tags, calculator_allowed, assessment_enabled FROM problem_sets WHERE id = ? LIMIT 1",
            [req.params.id]
        );

        if (problemSetRows.length === 0) {
            return res.status(404).json({ message: "Problem set not found." });
        }

        const problemSet = problemSetRows[0];

        const [problemRows] = await db.query(
            "SELECT type, prompt, choices, answer, points, explanation FROM problems WHERE problem_set_id = ? ORDER BY position ASC, id ASC",
            [problemSet.id]
        );

        const problemsJson = JSON.stringify(problemRows.map(row => ({
            type: row.type,
            prompt: row.prompt,
            choices: row.choices || undefined,
            answer: row.answer,
            points: row.points,
            explanation: row.explanation || undefined
        })));

        const [result] = await db.query(
            "INSERT INTO problem_set_suggestions (name, description, topic, subtopic, unit, tags, problems, submitter, status, editing_problem_set_id, calculator_allowed, assessment_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
            [problemSet.name, problemSet.description, problemSet.topic, problemSet.subtopic, problemSet.unit, problemSet.tags, problemsJson, req.user.username, problemSet.id, problemSet.calculator_allowed, problemSet.assessment_enabled]
        );

        res.status(201).json({ suggestionId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to start editing this problem set." });
    }
});

router.patch("/api/admin/problem-set-suggestions/:id", auth.requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body || {};
    const validStatuses = ["pending", "reviewed", "approved", "rejected"];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status." });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [suggestionRows] = await connection.query(
            "SELECT id, name, description, topic, subtopic, unit, tags, problems, editing_problem_set_id, calculator_allowed, assessment_enabled FROM problem_set_suggestions WHERE id = ? LIMIT 1 FOR UPDATE",
            [id]
        );

        if (suggestionRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Suggestion not found." });
        }

        const suggestion = suggestionRows[0];

        if (status === "rejected") {
            await connection.query("DELETE FROM problem_set_suggestions WHERE id = ?", [id]);
            await connection.commit();
            return res.json({ message: "Suggestion rejected and deleted.", deleted: true });
        }

        if (status === "approved") {
            let parsedProblems;
            try {
                parsedProblems = JSON.parse(suggestion.problems);
            } catch (err) {
                await connection.rollback();
                return res.status(400).json({ message: "Suggestion's problems data is malformed and can't be approved." });
            }

            const validProblems = (Array.isArray(parsedProblems) ? parsedProblems : [])
                .filter(problem => problem && problem.prompt && problem.answer);

            if (validProblems.length === 0) {
                await connection.rollback();
                return res.status(400).json({ message: "Suggestion has no valid problems to create." });
            }

            const manualTags = splitTags(suggestion.tags);
            const courseTags = await getCourseTagsForSubtopic(connection, suggestion.topic, suggestion.subtopic);
            const finalTags = mergeTags(manualTags, courseTags);

            let publishedProblemSetId = suggestion.editing_problem_set_id;

            if (publishedProblemSetId) {
                const [updateResult] = await connection.query(
                    "UPDATE problem_sets SET name = ?, description = ?, topic = ?, subtopic = ?, unit = ?, tags = ?, calculator_allowed = ?, assessment_enabled = ? WHERE id = ?",
                    [suggestion.name, suggestion.description, suggestion.topic, suggestion.subtopic, suggestion.unit, finalTags, suggestion.calculator_allowed, suggestion.assessment_enabled, publishedProblemSetId]
                );

                if (updateResult.affectedRows === 0) {
                    await connection.rollback();
                    return res.status(404).json({ message: "The problem set this suggestion was editing no longer exists." });
                }

                await connection.query("DELETE FROM problems WHERE problem_set_id = ?", [publishedProblemSetId]);
            } else {
                const [problemSetResult] = await connection.query(
                    "INSERT INTO problem_sets (name, description, topic, subtopic, unit, tags, calculator_allowed, assessment_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    [suggestion.name, suggestion.description, suggestion.topic, suggestion.subtopic, suggestion.unit, finalTags, suggestion.calculator_allowed, suggestion.assessment_enabled]
                );

                publishedProblemSetId = problemSetResult.insertId;
            }

            await insertProblemsIntoSet(connection, publishedProblemSetId, validProblems);

            await connection.query("DELETE FROM problem_set_suggestions WHERE id = ?", [id]);
            await connection.commit();
            return res.json({ message: "Suggestion approved and published.", createdProblemSetId: publishedProblemSetId, deleted: true });
        }

        await connection.query(
            "UPDATE problem_set_suggestions SET status = ? WHERE id = ?",
            [status, id]
        );

        await connection.commit();

        res.json({ message: "Status updated." });
    } catch (err) {
        await connection.rollback();
        console.error(err);
        res.status(500).json({ message: "Failed to update status." });
    } finally {
        connection.release();
    }
});

module.exports = router;
