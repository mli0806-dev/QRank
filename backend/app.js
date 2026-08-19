const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require("express");
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const auth = require('./auth');
const db = require('./config/db');
const { deleteExpiredPasswordResetCodes, deleteExpiredSessions } = require('./cleanup');

const app = express();
const frontendPath = path.join(__dirname, '../frontend');
const topicsPagePath = path.join(frontendPath, 'topics/index.html');
const profilePagePath = path.join(frontendPath, 'profile/index.html');
const competitionDetailPagePath = path.join(frontendPath, 'competitions/detail/index.html');
const problemSetDetailPagePath = path.join(frontendPath, 'problems/detail/index.html');
const notFoundPagePath = path.join(frontendPath, '404/index.html');
const sendTopicsPage = (req, res) => res.sendFile(topicsPagePath);
const sendProfilePage = (req, res) => res.sendFile(profilePagePath);
const sendCompetitionDetailPage = (req, res) => res.sendFile(competitionDetailPagePath);
const sendProblemSetDetailPage = (req, res) => res.sendFile(problemSetDetailPagePath);
const resetCodeTtlMinutes = parseInt(process.env.RESET_CODE_TTL_MINUTES || "15", 10);
const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const mailerReady = Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.SMTP_FROM
);
const allowDevEmailFallback = process.env.NODE_ENV !== "production";
const mailer = mailerReady
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    })
    : null;

const dummyPasswordHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." }
});

const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many attempts. Please try again later." }
});

// Looser than authLimiter -- these are legitimate public-use endpoints (submitting
// a suggestion, checking a quiz answer), not credential attempts, but both are
// unauthenticated writes/compute that could otherwise be spammed or answer-brute-forced.
const publicWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests. Please try again later." }
});

function generateVerificationCode() {
    return String(crypto.randomInt(100000, 1000000));
}

// Subtopics carry the real course codes for their curriculum (e.g. "IM1",
// "XLPHYS", "AP Calc BC" -- see subtopics.tags). Any problem set assigned to
// that subtopic should pick those up automatically rather than relying on
// whoever created it to type them in by hand.
async function getCourseTagsForSubtopic(queryable, topic, subtopic) {
    if (!topic || !subtopic) {
        return [];
    }

    const [rows] = await queryable.query(
        `
        SELECT subtopics.tags
        FROM subtopics
        JOIN topics ON topics.id = subtopics.topic_id
        WHERE topics.name = ? AND subtopics.name = ?
        LIMIT 1
        `,
        [topic, subtopic]
    );

    if (rows.length === 0 || !rows[0].tags) {
        return [];
    }

    return rows[0].tags.split(',').map(tag => tag.trim()).filter(Boolean);
}

function mergeTags(manualTags, courseTags) {
    const seen = new Set();
    const merged = [];

    for (const tag of [...manualTags, ...courseTags]) {
        const key = tag.toLowerCase();
        if (tag && !seen.has(key)) {
            seen.add(key);
            merged.push(tag);
        }
    }

    return merged.join(',');
}

async function sendPasswordResetEmail(email, username, code) {
    if (!mailer) {
        throw new Error("SMTP is not configured.");
    }

    await mailer.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: "QRank password reset code",
        text: `Hi ${username}, your QRank verification code is ${code}. It expires in ${resetCodeTtlMinutes} minutes.`
    });
}

const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' https://accounts.google.com",
    "style-src 'self' 'unsafe-inline' https://fonts.cdnfonts.com",
    "img-src 'self' data: https://accounts.google.com https://*.googleusercontent.com",
    "font-src 'self' https://fonts.cdnfonts.com",
    "connect-src 'self' https://accounts.google.com",
    "frame-src https://accounts.google.com https://doq.world",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'self'"
].join("; ");

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", contentSecurityPolicy);
    // Redundant with CSP's frame-ancestors for modern browsers, kept for older ones.
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    // Stops browsers from guessing content-types and executing e.g. an uploaded
    // "image" as script.
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Don't leak full URLs (which can contain query params) to third-party sites
    // linked from QRank; still send the origin for same-site navigation.
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    // Vercel already forces HTTPS at the edge; this tells the browser to never
    // even try HTTP for this origin again, closing the window an attacker would
    // otherwise have on a user's very first request.
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    next();
});

app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
        // Images change rarely and have no cache-busting filename hash, so a
        // week-long cache is safe. HTML/JS/CSS are excluded -- those change
        // constantly during active development and aren't hashed either, so
        // caching them the same way would serve stale code after a deploy.
        if (/\.(png|jpe?g|webp|svg|gif|ico)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=604800");
        }
    }
}));
app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));

app.get("/api/auth/google-config", (req, res) => {
    if (!googleClientId) {
        return res.json({
            enabled: false,
            message: "Google sign-in is not configured."
        });
    }

    res.json({
        enabled: true,
        clientId: googleClientId
    });
});

app.get("/api/auth/me", async (req, res) => {
    try {
        const user = await auth.getSessionUser(req);

        if (!user) {
            return res.status(401).json({ message: "Not authenticated." });
        }

        res.json({ user });
    } catch (err) {
        console.error("Failed to resolve session:", err);
        res.status(500).json({ message: "Failed to resolve session." });
    }
});

app.post("/api/logout", async (req, res) => {
    try {
        const token = req.signedCookies?.[auth.SESSION_COOKIE_NAME];
        await auth.destroySession(token);
        auth.clearSessionCookie(res);
        res.json({ message: "Logged out." });
    } catch (err) {
        console.error("Logout failed:", err);
        res.status(500).json({ message: "Logout failed." });
    }
});

// Triggered by Vercel Cron (see vercel.json) on serverless; the traditional-host
// setInterval in server.js calls the same two cleanup functions directly and
// doesn't need this route at all. Either trigger is fine because every query
// that reads these tables already filters on expires_at, so a delayed cleanup
// never affects correctness — only table size.
app.post("/api/cron/cleanup", async (req, res) => {
    const expectedAuth = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

    if (!expectedAuth || req.headers.authorization !== expectedAuth) {
        return res.status(401).json({ message: "Not authorized." });
    }

    try {
        await deleteExpiredPasswordResetCodes();
        await deleteExpiredSessions();
        res.json({ message: "Cleanup complete." });
    } catch (err) {
        console.error("Cron cleanup failed:", err);
        res.status(500).json({ message: "Cleanup failed." });
    }
});

app.get("/api/status", (req, res) => {
    res.json({
        status: "Online",
        timeStamp: new Date()
    });
});

app.get("/api/problem-sets/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM problem_sets");
        res.json({ count: rows[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch problem set count." });
    }
});

app.post("/api/problem-set-suggestions", publicWriteLimiter, async (req, res) => {
    try {
        const { name, description, topic, subtopic, tags, problems, submitter } = req.body || {};

        if (!name || !topic || !subtopic || !problems) {
            return res.status(400).json({ message: "Name, topic, subtopic, and problems are required." });
        }

        const cleanName = String(name).trim();
        const cleanDescription = String(description || "").trim();
        const cleanTopic = String(topic).trim();
        const cleanSubtopic = String(subtopic).trim();
        const cleanTags = String(tags || "")
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean)
            .join(',');
        const cleanProblems = String(problems).trim();
        const cleanSubmitter = submitter ? String(submitter).trim() : null;

        const [result] = await db.query(
            "INSERT INTO problem_set_suggestions (name, description, topic, subtopic, tags, problems, submitter) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [cleanName, cleanDescription, cleanTopic, cleanSubtopic, cleanTags, cleanProblems, cleanSubmitter]
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

app.get("/api/admin/problem-set-suggestions", auth.requireAdmin, async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id, name, description, topic, subtopic, tags, problems, submitter, status, created_at, created_problem_set_id FROM problem_set_suggestions ORDER BY created_at DESC"
        );

        const suggestions = rows.map(row => {
            let parsedProblems = [];
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
                tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
                problems: parsedProblems,
                submitter: row.submitter,
                status: row.status,
                createdAt: row.created_at,
                createdProblemSetId: row.created_problem_set_id
            };
        });

        res.json({ suggestions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load suggestions." });
    }
});

app.patch("/api/admin/problem-set-suggestions/:id", auth.requireAdmin, async (req, res) => {
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
            "SELECT id, name, description, topic, subtopic, tags, problems FROM problem_set_suggestions WHERE id = ? LIMIT 1 FOR UPDATE",
            [id]
        );

        if (suggestionRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Suggestion not found." });
        }

        const suggestion = suggestionRows[0];

        if (status === "rejected") {
            // Rejected suggestions don't hang around for review clutter -- delete outright.
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

            const manualTags = (suggestion.tags || "")
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean);
            const courseTags = await getCourseTagsForSubtopic(connection, suggestion.topic, suggestion.subtopic);
            const finalTags = mergeTags(manualTags, courseTags);

            const [problemSetResult] = await connection.query(
                "INSERT INTO problem_sets (name, description, topic, subtopic, tags) VALUES (?, ?, ?, ?, ?)",
                [suggestion.name, suggestion.description, suggestion.topic, suggestion.subtopic, finalTags]
            );

            const createdProblemSetId = problemSetResult.insertId;

            for (let position = 0; position < validProblems.length; position += 1) {
                const problem = validProblems[position];
                const type = problem.type === "multiple_choice" ? "multiple_choice" : "free_response";
                const choices = type === "multiple_choice" && Array.isArray(problem.choices)
                    ? JSON.stringify(problem.choices)
                    : null;

                await connection.query(
                    "INSERT INTO problems (problem_set_id, position, type, prompt, choices, answer) VALUES (?, ?, ?, ?, ?, ?)",
                    [createdProblemSetId, position, type, String(problem.prompt), choices, String(problem.answer)]
                );
            }

            // Once published, this suggestion has done its job -- it's now a real
            // problem_sets row, so there's no reason to keep the suggestion around too.
            await connection.query("DELETE FROM problem_set_suggestions WHERE id = ?", [id]);
            await connection.commit();
            return res.json({ message: "Suggestion approved and published.", createdProblemSetId, deleted: true });
        }

        // "pending" or "reviewed" -- just update the status flag, nothing to delete.
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

app.get("/topics", sendTopicsPage);
app.get("/topics/", sendTopicsPage);
app.get("/topics/:topicSlug", sendTopicsPage);
app.get("/topics/:topicSlug/:subtopicSlug", sendTopicsPage);
app.get(/^\/topics\/.*$/, sendTopicsPage);
app.get("/profile", sendProfilePage);
app.get("/profile/", sendProfilePage);
app.get("/profile/:username", sendProfilePage);
app.get("/competitions/:id", sendCompetitionDetailPage);
app.get("/problems/:id", sendProblemSetDetailPage);

app.get("/api/problem-sets", async (req, res) => {
    try {
        const searchTerm = String(req.query.search || "").trim();
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

        if (topicFilter) {
            conditions.push("LOWER(COALESCE(topic, '')) = ?");
            params.push(topicFilter.toLowerCase());
        }

        if (subtopicFilter) {
            conditions.push("LOWER(COALESCE(subtopic, '')) = ?");
            params.push(subtopicFilter.toLowerCase());
        }

        let query = `
            SELECT id, name, description, topic, subtopic, tags
            FROM problem_sets
        `;

        if (conditions.length > 0) {
            query += ` WHERE ${conditions.join(" AND ")}`;
        }

        query += ` ORDER BY name ASC`;

        const [rows] = await db.query(query, params);
        const normalizedRows = rows.map(row => ({
            ...row,
            tags: row.tags
                ? row.tags.split(',').map(tag => tag.trim()).filter(Boolean)
                : []
        }));

        res.json(normalizedRows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Problem set lookup failed." });
    }
});

app.post("/api/problem-sets", auth.requireAdmin, async (req, res) => {
    try {
        const { name, description, topic, subtopic, tags } = req.body || {};

        if (!name || !topic || !subtopic) {
            return res.status(400).json({ message: "Name, topic, and subtopic are required." });
        }

        const cleanName = String(name).trim();
        const cleanDescription = String(description || "").trim();
        const cleanTopic = String(topic).trim();
        const cleanSubtopic = String(subtopic).trim();
        const manualTags = String(tags || "")
            .split(',')
            .map(tag => tag.trim())
            .filter(Boolean);
        const courseTags = await getCourseTagsForSubtopic(db, cleanTopic, cleanSubtopic);
        const cleanTags = mergeTags(manualTags, courseTags);

        const [result] = await db.query(
            "INSERT INTO problem_sets (name, description, topic, subtopic, tags) VALUES (?, ?, ?, ?, ?)",
            [cleanName, cleanDescription, cleanTopic, cleanSubtopic, cleanTags]
        );

        res.status(201).json({
            message: "Problem set created successfully.",
            problemSet: {
                id: result.insertId,
                name: cleanName,
                description: cleanDescription,
                topic: cleanTopic,
                subtopic: cleanSubtopic,
                tags: cleanTags
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Problem set creation failed." });
    }
});

app.get("/api/problem-sets/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [problemSetRows] = await db.query(
            "SELECT id, name, description, topic, subtopic, tags FROM problem_sets WHERE id = ? LIMIT 1",
            [id]
        );

        if (problemSetRows.length === 0) {
            return res.status(404).json({ message: "Problem set not found." });
        }

        const [problemRows] = await db.query(
            "SELECT id, position, type, prompt, choices FROM problems WHERE problem_set_id = ? ORDER BY position ASC, id ASC",
            [id]
        );

        const problemSet = problemSetRows[0];
        problemSet.tags = problemSet.tags
            ? problemSet.tags.split(',').map(tag => tag.trim()).filter(Boolean)
            : [];

        res.json({
            problemSet,
            problems: problemRows.map(row => ({
                id: row.id,
                type: row.type,
                prompt: row.prompt,
                choices: row.choices
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load problem set." });
    }
});

app.post("/api/problem-sets/:id/check", publicWriteLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const submitted = (req.body && req.body.answers) || {};

        const [problemRows] = await db.query(
            "SELECT id, type, answer FROM problems WHERE problem_set_id = ?",
            [id]
        );

        if (problemRows.length === 0) {
            return res.status(404).json({ message: "Problem set not found or has no problems." });
        }

        const results = {};
        let correctCount = 0;

        for (const problem of problemRows) {
            const submittedAnswer = String(submitted[problem.id] ?? "").trim();
            const acceptableAnswers = problem.answer.split(',').map(a => a.trim().toLowerCase());
            const isCorrect = acceptableAnswers.includes(submittedAnswer.toLowerCase()) && submittedAnswer !== "";

            results[problem.id] = isCorrect;
            if (isCorrect) {
                correctCount += 1;
            }
        }

        res.json({
            results,
            correctCount,
            total: problemRows.length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to check answers." });
    }
});

app.get("/api/topics", async (req, res) => {
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

app.get("/api/topics/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM topics");
        res.json({ count: rows[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch topic count." });
    }
});

app.get("/api/users/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM users");
        res.json({ count: rows[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch user count." });
    }
});

app.get("/api/tags", async (req, res) => {
    try {
        const [subtopicRows] = await db.query("SELECT tags FROM subtopics WHERE tags IS NOT NULL AND tags <> ''");
        const [problemSetRows] = await db.query("SELECT tags FROM problem_sets WHERE tags IS NOT NULL AND tags <> ''");

        const seen = new Set();
        const tags = [];

        [...subtopicRows, ...problemSetRows].forEach((row) => {
            row.tags.split(',').map(tag => tag.trim()).filter(Boolean).forEach((tag) => {
                const key = tag.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    tags.push(tag);
                }
            });
        });

        tags.sort((a, b) => a.localeCompare(b));

        res.json({ tags });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch tags." });
    }
});

app.get("/api/users/:username", async (req, res) => {
    try {
        const { username } = req.params;
        const viewer = await auth.getSessionUser(req);
        const [rows] = await db.query(
            "SELECT id, username, email, public_email, bio FROM users WHERE username = ? LIMIT 1",
            [username]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const user = rows[0];
        const isOwner = Boolean(viewer && viewer.username.toLowerCase() === username.toLowerCase());

        res.json({
            user: {
                id: user.id,
                username: user.username,
                bio: user.bio || "",
                publicEmail: Boolean(user.public_email),
                email: isOwner || Boolean(user.public_email) ? user.email : null
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "User lookup failed." });
    }
});

app.put("/api/users/:username", auth.requireAuth, async (req, res) => {
    try {
        const { username } = req.params;
        const { bio, publicEmail } = req.body;

        if (req.user.username.toLowerCase() !== username.toLowerCase()) {
            return res.status(403).json({ message: "Not authorized." });
        }

        const cleanBio = String(bio || "").trim().slice(0, 500);
        const isPublicEmail = Boolean(publicEmail);

        await db.query(
            "UPDATE users SET bio = ?, public_email = ? WHERE username = ?",
            [cleanBio, isPublicEmail ? 1 : 0, username]
        );

        const [rows] = await db.query(
            "SELECT id, username, email, public_email, bio FROM users WHERE username = ? LIMIT 1",
            [username]
        );

        const user = rows[0];

        res.json({
            message: "Profile updated successfully.",
            user: {
                id: user.id,
                username: user.username,
                bio: user.bio || "",
                publicEmail: Boolean(user.public_email),
                email: user.email
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Profile update failed." });
    }
});

app.post("/api/password-reset/request", passwordResetLimiter, async (req, res) => {
    try {
        const { username, email } = req.body;

        if (!username && !email) {
            return res.status(400).json({ message: "Username is required." });
        }

        const [users] = username
            ? await db.query(
                "SELECT id, username, email FROM users WHERE username = ? LIMIT 1",
                [username]
            )
            : await db.query(
                "SELECT id, username, email FROM users WHERE email = ? LIMIT 1",
                [email]
            );

        if (users.length === 0) {
            return res.json({ message: "If the account exists, a verification code has been sent." });
        }

        const user = users[0];
        const code = generateVerificationCode();
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + resetCodeTtlMinutes * 60 * 1000);

        await deleteExpiredPasswordResetCodes();

        await db.query(
            "DELETE FROM password_reset_codes WHERE user_id = ? AND used_at IS NULL",
            [user.id]
        );

        await db.query(
            "INSERT INTO password_reset_codes (user_id, email, code_hash, expires_at) VALUES (?, ?, ?, ?)",
            [user.id, user.email, codeHash, expiresAt]
        );

        if (mailerReady) {
            await sendPasswordResetEmail(user.email, user.username, code);
            return res.json({ message: "A verification code has been sent to your email." });
        }

        if (allowDevEmailFallback) {
            console.log(`DEV password reset code for ${user.email}: ${code}`);
            return res.json({
                message: "Email is not configured. This is a local development code.",
                verificationCode: code
            });
        }

        return res.status(503).json({
            message: "Email service is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM."
        });
    } catch (err) {
        console.error("Password reset request failed:", err);
        res.status(500).json({ message: "Password reset request failed." });
    }
});

app.post("/api/password-reset/verify", passwordResetLimiter, async (req, res) => {
    try {
        const { code, newPassword } = req.body;

        if (!code || !newPassword) {
            return res.status(400).json({ message: "Code and new password are required." });
        }

        const [tokens] = await db.query(
            "SELECT id, user_id, code_hash FROM password_reset_codes WHERE used_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC"
        );

        if (tokens.length === 0) {
            return res.status(400).json({ message: "Verification code expired or invalid." });
        }

        let matchedToken = null;
        for (const token of tokens) {
            const codeMatches = await bcrypt.compare(String(code), token.code_hash);
            if (codeMatches) {
                matchedToken = token;
                break;
            }
        }

        if (!matchedToken) {
            return res.status(400).json({ message: "Verification code expired or invalid." });
        }

        const [users] = await db.query(
            "SELECT id FROM users WHERE id = ? LIMIT 1",
            [matchedToken.user_id]
        );

        if (users.length === 0) {
            return res.status(400).json({ message: "Verification code expired or invalid." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            [hashedPassword, matchedToken.user_id]
        );

        await db.query(
            "UPDATE password_reset_codes SET used_at = NOW() WHERE id = ?",
            [matchedToken.id]
        );

        await auth.destroyUserSessions(matchedToken.user_id);

        res.json({ message: "Password updated successfully." });
    } catch (err) {
        console.error("Password reset verify failed:", err);
        res.status(500).json({ message: "Password reset verify failed." });
    }
});

app.get("/api/competitions", async (req, res) => {
    try {
        const {year, month} = req.query;

        if (!year || !month) {
            return res.status(400).json({message: "Year and month are required."});
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
            WHERE start_date <= ? AND end_date >= ?
        `, [endDateBoundary, startDateBoundary]);
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({message: "Database query failed."})
    }
});

app.get("/api/competitions/:id", async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(`
            SELECT id, title, category,
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

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Database query failed." });
    }
});

app.post("/api/register", authLimiter, async (req, res) => {
    try {
        const {username, email, password} = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({message: "Username, email, and password are required."});
        }

        const [existingUser] = await db.query("SELECT id FROM users WHERE email = ? OR username = ?", [email, username]);

        if (existingUser.length > 0) {
            return res.status(400).json({message: "User with this email or username already exists."});
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", [username, email, hashedPassword]);

        res.status(201).json({message: "User registered successfully."});
    } catch (err) {
        console.error(err);
        console.error("User registration error:", err);
        res.status(500).json({message: "User registration failed."});
    }
});

function buildGoogleUsername(seedName) {
    return String(seedName || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 16) || "user";
}

async function getUniqueUsername(seedName) {
    const base = buildGoogleUsername(seedName);

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const suffix = attempt === 0 ? "" : String(crypto.randomInt(1000, 9999));
        const username = `${base}${suffix}`;
        const [rows] = await db.query(
            "SELECT id FROM users WHERE username = ? LIMIT 1",
            [username]
        );

        if (rows.length === 0) {
            return username;
        }
    }

    return `${base}${crypto.randomInt(100000, 999999)}`;
}

async function verifyGoogleCredential(credential) {
    if (!googleClientId) {
        throw new Error("Google sign-in is not configured.");
    }

    const verifyUrl = new URL("https://oauth2.googleapis.com/tokeninfo");
    verifyUrl.searchParams.set("id_token", credential);

    const response = await fetch(verifyUrl);
    const profile = await response.json();

    if (!response.ok) {
        throw new Error(profile.error_description || profile.error || "Google token verification failed.");
    }

    if (profile.aud !== googleClientId) {
        throw new Error("Google token audience mismatch.");
    }

    if (String(profile.email_verified).toLowerCase() !== "true") {
        throw new Error("Google email is not verified.");
    }

    if (!profile.email || !profile.sub) {
        throw new Error("Google profile is incomplete.");
    }

    return profile;
}

app.post("/api/auth/google", authLimiter, async (req, res) => {
    try {
        if (!googleClientId) {
            return res.status(503).json({ message: "Google sign-in is not configured." });
        }

        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({ message: "Google credential is required." });
        }

        const profile = await verifyGoogleCredential(credential);
        const email = profile.email.toLowerCase();
        const googleSub = profile.sub;
        const displayName = profile.name || profile.given_name || email.split("@")[0];

        const [matchedUsers] = await db.query(
            "SELECT id, username, email, google_sub FROM users WHERE google_sub = ? OR email = ? LIMIT 1",
            [googleSub, email]
        );

        let user = matchedUsers[0] || null;

        if (user) {
            if (!user.google_sub) {
                await db.query(
                    "UPDATE users SET google_sub = ? WHERE id = ?",
                    [googleSub, user.id]
                );
            }
        } else {
            const username = await getUniqueUsername(displayName);
            const randomPassword = crypto.randomBytes(32).toString("hex");
            const passwordHash = await bcrypt.hash(randomPassword, 10);

            const [insertResult] = await db.query(
                "INSERT INTO users (username, email, password_hash, google_sub) VALUES (?, ?, ?, ?)",
                [username, email, passwordHash, googleSub]
            );

            user = {
                id: insertResult.insertId,
                username,
                email,
                google_sub: googleSub
            };
        }

        const [latestUserRows] = await db.query(
            "SELECT id, username, email FROM users WHERE id = ? LIMIT 1",
            [user.id]
        );

        const { token, expiresAt } = await auth.createSession(user.id);
        auth.setSessionCookie(res, token, expiresAt);

        res.json({
            message: "Google login successful.",
            user: latestUserRows[0]
        });
    } catch (err) {
        console.error("Google login failed:", err);
        res.status(500).json({ message: err.message || "Google login failed." });
    }
});

app.post("/api/login", authLimiter, async (req, res) => {
    try {
        const {email, password} = req.body;

        if (!email || !password) {
            return res.status(400).json({message: "Email and password are required."});
        }

        const [rows] = await db.query("SELECT id, username, password_hash FROM users WHERE email = ?", [email]);
        const user = rows[0] || null;
        const passwordMatch = await bcrypt.compare(password, user ? user.password_hash : dummyPasswordHash);

        if (!user || !passwordMatch) {
            return res.status(400).json({message: "Invalid email or password."});
        }

        const { token, expiresAt } = await auth.createSession(user.id);
        auth.setSessionCookie(res, token, expiresAt);

        res.json({message: "Login successful.", user: {id: user.id, username: user.username}});

    } catch (err) {
        console.error(err);
        console.error("User login error:", err);
        res.status(500).json({message: "User login failed."});
    }
});

app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
        return res.status(404).json({ message: "Not found." });
    }

    res.status(404).sendFile(notFoundPagePath);
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ message: "Something went wrong." });
});

module.exports = app;
