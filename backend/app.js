const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const auth = require('./auth');
const db = require('./config/db');
const { deleteExpiredPasswordResetCodes, deleteExpiredSessions } = require('./cleanup');

const app = express();
const frontendPath = path.join(__dirname, '../frontend');
const topicsPagePath = path.join(frontendPath, 'topics/index.html');
const profilePagePath = path.join(frontendPath, 'profile/index.html');
const sendTopicsPage = (req, res) => res.sendFile(topicsPagePath);
const sendProfilePage = (req, res) => res.sendFile(profilePagePath);
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

function generateVerificationCode() {
    return String(crypto.randomInt(100000, 1000000));
}

async function ensurePasswordResetTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS password_reset_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            email VARCHAR(255) NOT NULL,
            code_hash VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_password_reset_user_id (user_id),
            INDEX idx_password_reset_email (email),
            INDEX idx_password_reset_expires_at (expires_at)
        )
    `);
}

async function ensureSessionsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            token_hash CHAR(64) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            UNIQUE INDEX idx_sessions_token_hash (token_hash),
            INDEX idx_sessions_user_id (user_id)
        )
    `);
}

async function ensureGoogleAuthColumns() {
    const [columnRows] = await db.query(
        `
        SELECT COUNT(*) AS column_count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'google_sub'
        `
    );

    if (columnRows[0].column_count === 0) {
        await db.query("ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) DEFAULT NULL");
    }

    const [indexRows] = await db.query(
        `
        SELECT COUNT(*) AS index_count
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND INDEX_NAME = 'idx_users_google_sub'
        `
    );

    if (indexRows[0].index_count === 0) {
        await db.query("ALTER TABLE users ADD INDEX idx_users_google_sub (google_sub)");
    }
}

async function ensureProfileVisibilityColumns() {
    const [emailColumns] = await db.query(
        `
        SELECT COUNT(*) AS column_count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'public_email'
        `
    );

    if (emailColumns[0].column_count === 0) {
        await db.query("ALTER TABLE users ADD COLUMN public_email TINYINT(1) NOT NULL DEFAULT 0");
    }

    const [bioColumns] = await db.query(
        `
        SELECT COUNT(*) AS column_count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'users'
          AND COLUMN_NAME = 'bio'
        `
    );

    if (bioColumns[0].column_count === 0) {
        await db.query("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL");
    }
}

async function ensureProblemSetsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS problem_sets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            topic VARCHAR(255) DEFAULT NULL,
            subtopic VARCHAR(255) DEFAULT NULL,
            tags VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_problem_sets_name (name),
            INDEX idx_problem_sets_topic (topic),
            INDEX idx_problem_sets_subtopic (subtopic),
            INDEX idx_problem_sets_tags (tags)
        )
    `);

    const [topicColumns] = await db.query(
        `
        SELECT COUNT(*) AS column_count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'problem_sets'
          AND COLUMN_NAME = 'topic'
        `
    );

    if (topicColumns[0].column_count === 0) {
        await db.query("ALTER TABLE problem_sets ADD COLUMN topic VARCHAR(255) DEFAULT NULL");
    }

    const [subtopicColumns] = await db.query(
        `
        SELECT COUNT(*) AS column_count
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'problem_sets'
          AND COLUMN_NAME = 'subtopic'
        `
    );

    if (subtopicColumns[0].column_count === 0) {
        await db.query("ALTER TABLE problem_sets ADD COLUMN subtopic VARCHAR(255) DEFAULT NULL");
    }
}

async function ensureProblemSuggestionTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS problem_set_suggestions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT DEFAULT NULL,
            topic VARCHAR(255) DEFAULT NULL,
            subtopic VARCHAR(255) DEFAULT NULL,
            tags VARCHAR(255) DEFAULT NULL,
            problems TEXT NOT NULL,
            submitter VARCHAR(255) DEFAULT NULL,
            status ENUM('pending', 'reviewed', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_suggestions_topic (topic),
            INDEX idx_suggestions_subtopic (subtopic),
            INDEX idx_suggestions_status (status)
        )
    `);
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

// Schema is ensured once per process start: once at server boot on a traditional
// host, or once per cold start on serverless — either way this only runs when a
// fresh process/module instance loads, never per-request.
ensurePasswordResetTable().catch(err => {
    console.error("Failed to ensure password_reset_codes table exists:", err);
});

ensureSessionsTable().catch(err => {
    console.error("Failed to ensure sessions table exists:", err);
});

ensureGoogleAuthColumns().catch(err => {
    console.error("Failed to ensure Google auth columns exist:", err);
});

ensureProfileVisibilityColumns().catch(err => {
    console.error("Failed to ensure profile visibility columns exist:", err);
});

ensureProblemSetsTable().catch(err => {
    console.error("Failed to ensure problem_sets table exists:", err);
});

ensureProblemSuggestionTable().catch(err => {
    console.error("Failed to ensure problem_set_suggestions table exists:", err);
});

app.use(express.static(frontendPath));
app.use(cors());
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

app.post("/api/problem-set-suggestions", async (req, res) => {
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

app.get("/topics", sendTopicsPage);
app.get("/topics/", sendTopicsPage);
app.get("/topics/:topicSlug", sendTopicsPage);
app.get("/topics/:topicSlug/:subtopicSlug", sendTopicsPage);
app.get(/^\/topics\/.*$/, sendTopicsPage);
app.get("/profile", sendProfilePage);
app.get("/profile/", sendProfilePage);
app.get("/profile/:username", sendProfilePage);

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

app.post("/api/problem-sets", async (req, res) => {
    try {
        const { name, description, topic, subtopic, tags } = req.body || {};

        if (!name || !topic || !subtopic) {
            return res.status(400).json({ message: "Name, topic, and subtopic are required." });
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

app.get("/api/topics/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM topics");
        res.json({ count: rows[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch topic count." });
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

app.post("/api/password-reset/request", async (req, res) => {
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

app.post("/api/password-reset/verify", async (req, res) => {
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

app.post("/api/register", async (req, res) => {
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

app.post("/api/auth/google", async (req, res) => {
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

app.post("/api/login", async (req, res) => {
    try {
        const {email, password} = req.body;

        if (!email || !password) {
            return res.status(400).json({message: "Email and password are required."});
        }

        const [rows] = await db.query("SELECT id, username, password_hash FROM users WHERE email = ?", [email]);

        if (rows.length === 0) {
            return res.status(400).json({message: "Invalid email or password."});
        }

        const user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return res.status(400).json({message: "Invalid password."});
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

module.exports = app;
