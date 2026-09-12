const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const auth = require('../auth');
const db = require('../config/db');
const env = require('../env');
const { publicReadLimiter, publicWriteLimiter, passwordResetLimiter } = require('../middleware/rateLimiters');
const { shapeUserForResponse } = require('../services/userShaping');
const { dummyPasswordHash } = require('../services/security');
const { mailerReady, sendPasswordResetEmail, sendPasswordChangedNotification } = require('../services/mailer');
const { deleteExpiredPasswordResetCodes } = require('../cleanup');

const router = express.Router();

const MIN_PASSWORD_LENGTH = 8;
const RESET_REQUEST_COOLDOWN_SECONDS = 60;

function isPasswordStrongEnough(password) {
    return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

function generateVerificationCode() {
    return String(crypto.randomInt(100000, 1000000));
}

router.get("/api/users/count", async (req, res) => {
    try {
        const [rows] = await db.query("SELECT COUNT(*) AS count FROM users");
        res.json({ count: rows[0]?.count || 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch user count." });
    }
});

router.get("/api/users/:username", publicReadLimiter, async (req, res) => {
    try {
        const { username } = req.params;
        const viewer = await auth.getSessionUser(req);
        const [rows] = await db.query(
            "SELECT id, username, email, public_email, bio, qscore, (SELECT COUNT(*) FROM users u2 WHERE u2.id <= users.id) AS display_id FROM users WHERE username = ? LIMIT 1",
            [username]
        );

        if (rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        const user = rows[0];
        const isOwner = Boolean(viewer && viewer.username.toLowerCase() === username.toLowerCase());

        res.json({ user: shapeUserForResponse(user, { isOwner }) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "User lookup failed." });
    }
});

router.put("/api/users/:username", publicWriteLimiter, auth.requireAuth, async (req, res) => {
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
            "SELECT id, username, email, public_email, bio, qscore, (SELECT COUNT(*) FROM users u2 WHERE u2.id <= users.id) AS display_id FROM users WHERE username = ? LIMIT 1",
            [username]
        );

        const user = rows[0];

        res.json({
            message: "Profile updated successfully.",
            user: shapeUserForResponse(user, { isOwner: true })
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Profile update failed." });
    }
});

router.post("/api/password-reset/request", passwordResetLimiter, async (req, res) => {
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

        const genericResponse = { message: "If the account exists, a verification code has been sent." };

        if (users.length === 0) {
            return res.json(genericResponse);
        }

        const user = users[0];

        await deleteExpiredPasswordResetCodes();

        const [recentCodes] = await db.query(
            "SELECT id FROM password_reset_codes WHERE user_id = ? AND used_at IS NULL AND created_at > (NOW() - INTERVAL ? SECOND) LIMIT 1",
            [user.id, RESET_REQUEST_COOLDOWN_SECONDS]
        );

        if (recentCodes.length > 0) {
            return res.json(genericResponse);
        }

        const code = generateVerificationCode();
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + env.resetCodeTtlMinutes * 60 * 1000);

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

        if (env.allowDevEmailFallback) {
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

router.post("/api/password-reset/verify", passwordResetLimiter, async (req, res) => {
    try {
        const { username, email, code, newPassword } = req.body;

        if ((!username && !email) || !code || !newPassword) {
            return res.status(400).json({ message: "Account, code, and new password are required." });
        }

        if (!isPasswordStrongEnough(newPassword)) {
            return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
        }

        const [users] = username
            ? await db.query("SELECT id, username, email FROM users WHERE username = ? LIMIT 1", [username])
            : await db.query("SELECT id, username, email FROM users WHERE email = ? LIMIT 1", [email]);

        const user = users[0] || null;

        let matchedToken = null;
        if (user) {
            const [tokens] = await db.query(
                "SELECT id, code_hash FROM password_reset_codes WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1",
                [user.id]
            );
            matchedToken = tokens[0] || null;
        }

        const codeMatches = await bcrypt.compare(String(code), matchedToken ? matchedToken.code_hash : dummyPasswordHash);

        if (!user || !matchedToken || !codeMatches) {
            return res.status(400).json({ message: "Verification code expired or invalid." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hashedPassword, user.id]);
        await db.query("UPDATE password_reset_codes SET used_at = NOW() WHERE id = ?", [matchedToken.id]);
        await auth.destroyUserSessions(user.id);

        try {
            await sendPasswordChangedNotification(user.email, user.username);
        } catch (notifyErr) {
            console.error("Failed to send password-changed notification:", notifyErr);
        }

        res.json({ message: "Password updated successfully." });
    } catch (err) {
        console.error("Password reset verify failed:", err);
        res.status(500).json({ message: "Password reset verify failed." });
    }
});

module.exports = router;
