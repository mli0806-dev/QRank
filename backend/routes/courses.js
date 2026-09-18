const express = require('express');
const db = require('../config/db');
const { publicReadLimiter } = require('../middleware/rateLimiters');
const { splitTags, mergeTags } = require('../services/tags');

const router = express.Router();

router.get("/api/topics", publicReadLimiter, async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                topics.name AS topic,
                subtopics.id AS subtopic_id,
                subtopics.name AS subtopic,
                subtopics.tags,
                units.id AS unit_id,
                units.name AS unit_name
            FROM topics
            LEFT JOIN subtopics ON topics.id = subtopics.topic_id
            LEFT JOIN units ON units.subtopic_id = subtopics.id
        `);
        const groupedtopics = {};
        const subtopicsById = new Map();

        rows.forEach(row => {
            if (!groupedtopics[row.topic]) {
                groupedtopics[row.topic] = {
                    topic: row.topic,
                    subtopics: []
                };
            }

            if (row.subtopic) {
                let subtopicEntry = subtopicsById.get(row.subtopic_id);
                if (!subtopicEntry) {
                    subtopicEntry = {
                        id: row.subtopic_id,
                        name: row.subtopic,
                        tags: row.tags,
                        units: []
                    };
                    subtopicsById.set(row.subtopic_id, subtopicEntry);
                    groupedtopics[row.topic].subtopics.push(subtopicEntry);
                }

                if (row.unit_id) {
                    subtopicEntry.units.push({ id: row.unit_id, name: row.unit_name });
                }
            }
        });
        const nested = Object.values(groupedtopics);
        res.json(nested);
    } catch (err) {
        console.error(err);
        res.status(500).json({message: "Database query failed."})
    }
});

router.get("/api/topics/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM topics");
        res.json({ count: rows[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch topic count." });
    }
});

router.get("/api/tags", publicReadLimiter, async (req, res) => {
    try {
        const [subtopicRows] = await db.query("SELECT tags FROM subtopics WHERE tags IS NOT NULL AND tags <> ''");
        const [problemSetRows] = await db.query("SELECT tags FROM problem_sets WHERE tags IS NOT NULL AND tags <> ''");

        const allTags = [...subtopicRows, ...problemSetRows].flatMap((row) => splitTags(row.tags));
        const tags = splitTags(mergeTags(allTags, [])).sort((a, b) => a.localeCompare(b));

        res.json({ tags });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch tags." });
    }
});

module.exports = router;
