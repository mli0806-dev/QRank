const express = require("express");
const cors = require("cors");
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, '../frontend')));
app.use(cors());
app.use(express.json());

app.get("/api/status", (req, res) => {
    res.json({
        status: "Online",
        timeStamp: new Date()
    });
});

app.listen(PORT, () => {
    console.log(`QRank Server is running at http://localhost:${PORT}`);
});

const db = require('./config/db');

app.get("/api/topics", async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                topics.name AS topic, 
                subtopics.id AS subtopic_id,
                subtopics.name AS subtopic, 
                subtopics.tags 
            FROM topics
            LEFT JOIN subtopics ON topics.id = subtopics.topic_id
        `);
        const groupedtopics = {};
        rows.forEach(row => {
            if (!groupedtopics[row.topic]) {
                groupedtopics[row.topic] = {
                    topic: row.topic,
                    subtopics: []
                };
            }
            if (row.subtopic) {
                groupedtopics[row.topic].subtopics.push({
                    id: row.subtopic_id,
                    name: row.subtopic,
                    tags: row.tags
                });
            }
        });
        const nested = Object.values(groupedtopics);
        res.json(nested);
    } catch (err) {
        console.error(err);
        res.status(500).json({message: "Database query failed."})
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
