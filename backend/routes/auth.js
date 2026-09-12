const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const auth = require('../auth');
const validation = require('../validation');
const db = require('../config/db');
const { authLimiter } = require('../middleware/rateLimiters');
const { dummyPasswordHash } = require('../services/security');
const { getUniqueUsername, verifyGoogleCredential } = require('../services/googleAuth');
const env = require('../env');

const router = express.Router();

router.post("/api/register", authLimiter, async (req, res) => {
    try {
        const {username, email, password} = req.body || {};

        if (!username || !email || !password) {
            return res.status(400).json({message: "Username, email, and password are required."});
        }

        const validationResult = validation.registerSchema.safeParse({ username, email, password });

        if (!validationResult.success) {
            return res.status(400).json({ message: validationResult.error.issues[0].message });
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

router.post("/api/auth/google", authLimiter, async (req, res) => {
    try {
        if (!env.googleClientId) {
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
        res.status(500).json({ message: "Google login failed." });
    }
});

router.post("/api/login", authLimiter, async (req, res) => {
    try {
        const {email, password} = req.body || {};

        if (!email || !password) {
            return res.status(400).json({message: "Email and password are required."});
        }

        const validationResult = validation.loginSchema.safeParse({ email, password });

        if (!validationResult.success) {
            return res.status(400).json({ message: "Invalid email or password." });
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

module.exports = router;
