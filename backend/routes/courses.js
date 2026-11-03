const express = require('express');
const db = require('../config/db');
const auth = require('../auth');
const validation = require('../validation');
const { publicReadLimiter } = require('../middleware/rateLimiters');
const { splitTags, mergeTags } = require('../services/tags');

const router = express.Router();

router.get("/api/courses", publicReadLimiter, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                courses.name AS course,
                topics.id AS topic_id,
                topics.name AS topic,
                topics.tags,
                subtopics.id AS subtopic_id,
                subtopics.name AS subtopic_name
            FROM courses
            LEFT JOIN topics ON courses.id = topics.course_id
            LEFT JOIN subtopics ON subtopics.topic_id = topics.id
        `);
        const groupedcourses = {};
        const topicsById = new Map();

        rows.forEach(row => {
            if (!groupedcourses[row.course]) {
                groupedcourses[row.course] = {
                    course: row.course,
                    topics: []
                };
            }

            if (row.topic) {
                let topicEntry = topicsById.get(row.topic_id);
                if (!topicEntry) {
                    topicEntry = {
                        id: row.topic_id,
                        name: row.topic,
                        tags: row.tags,
                        subtopics: []
                    };
                    topicsById.set(row.topic_id, topicEntry);
                    groupedcourses[row.course].topics.push(topicEntry);
                }

                if (row.subtopic_id) {
                    topicEntry.subtopics.push({ id: row.subtopic_id, name: row.subtopic_name });
                }
            }
        });
        const nested = Object.values(groupedcourses);
        res.json(nested);
    } catch (err) {
        console.error(err);
        res.status(500).json({message: "Database query failed."})
    }
});

router.get("/api/courses/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM courses");
        res.json({ count: rows[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch course count." });
    }
});

router.get("/api/tags", publicReadLimiter, async (req, res) => {
    try {
        const [topicRows] = await db.query("SELECT tags FROM topics WHERE tags IS NOT NULL AND tags <> ''");
        const [problemSetRows] = await db.query("SELECT tags FROM problem_sets WHERE tags IS NOT NULL AND tags <> ''");

        const allTags = [...topicRows, ...problemSetRows].flatMap((row) => splitTags(row.tags));
        const tags = splitTags(mergeTags(allTags, [])).sort((a, b) => a.localeCompare(b));

        res.json({ tags });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch tags." });
    }
});

function mapResource(row) {
    return {
        id: row.id,
        title: row.title,
        url: row.url,
        description: row.description || ""
    };
}

router.get("/api/topics/:topicId/resources", publicReadLimiter, async (req, res) => {
    try {
        const topicId = Number(req.params.topicId);

        if (!Number.isInteger(topicId) || topicId <= 0) {
            return res.status(400).json({ message: "Invalid topic id." });
        }

        const [rows] = await db.query(
            "SELECT id, title, url, description FROM topic_resources WHERE topic_id = ? ORDER BY id ASC",
            [topicId]
        );

        res.json({ resources: rows.map(mapResource) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch topic resources." });
    }
});

router.post("/api/topics/:topicId/resources", auth.requireAdmin, async (req, res) => {
    try {
        const topicId = Number(req.params.topicId);

        if (!Number.isInteger(topicId) || topicId <= 0) {
            return res.status(400).json({ message: "Invalid topic id." });
        }

        const result = validation.topicResourceSchema.safeParse(req.body || {});

        if (!result.success) {
            return res.status(400).json({ message: result.error.issues[0].message });
        }

        const [topicRows] = await db.query("SELECT id FROM topics WHERE id = ? LIMIT 1", [topicId]);

        if (!topicRows.length) {
            return res.status(404).json({ message: "Topic not found." });
        }

        const { title, url, description } = result.data;

        const [insert] = await db.query(
            "INSERT INTO topic_resources (topic_id, title, url, description, created_by) VALUES (?, ?, ?, ?, ?)",
            [topicId, title, url, description || null, req.user.id]
        );

        res.status(201).json({ resource: mapResource({ id: insert.insertId, title, url, description }) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to add topic resource." });
    }
});

router.delete("/api/topic-resources/:id", auth.requireAdmin, async (req, res) => {
    try {
        const resourceId = Number(req.params.id);

        if (!Number.isInteger(resourceId) || resourceId <= 0) {
            return res.status(400).json({ message: "Invalid resource id." });
        }

        const [result] = await db.query("DELETE FROM topic_resources WHERE id = ?", [resourceId]);

        if (!result.affectedRows) {
            return res.status(404).json({ message: "Resource not found." });
        }

        res.json({ message: "Resource deleted." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete topic resource." });
    }
});

module.exports = router;
