const path = require('path');
const express = require('express');
const auth = require('../auth');
const env = require('../env');
const { deleteExpiredPasswordResetCodes, deleteExpiredSessions } = require('../cleanup');

const router = express.Router();

const frontendPath = path.join(__dirname, '../../frontend');
const topicsPagePath = path.join(frontendPath, 'topics/index.html');
const profilePagePath = path.join(frontendPath, 'profile/index.html');
const competitionDetailPagePath = path.join(frontendPath, 'competitions/detail/index.html');
const problemSetDetailPagePath = path.join(frontendPath, 'problems/detail/index.html');

const sendTopicsPage = (req, res) => res.sendFile(topicsPagePath);
const sendProfilePage = (req, res) => res.sendFile(profilePagePath);
const sendCompetitionDetailPage = (req, res) => res.sendFile(competitionDetailPagePath);
const sendProblemSetDetailPage = (req, res) => res.sendFile(problemSetDetailPagePath);

router.get("/api/auth/google-config", (req, res) => {
    if (!env.googleClientId) {
        return res.json({
            enabled: false,
            message: "Google sign-in is not configured."
        });
    }

    res.json({
        enabled: true,
        clientId: env.googleClientId
    });
});

router.get("/api/desmos-config", (req, res) => {
    if (!env.desmosApiKey) {
        return res.json({
            enabled: false,
            message: "Desmos tools are not configured."
        });
    }

    res.json({
        enabled: true,
        apiKey: env.desmosApiKey
    });
});

router.get("/api/auth/me", async (req, res) => {
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

router.post("/api/logout", async (req, res) => {
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

router.post("/api/cron/cleanup", async (req, res) => {
    const expectedAuth = env.cronSecret ? `Bearer ${env.cronSecret}` : null;

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

router.get("/api/status", (req, res) => {
    res.json({
        status: "Online",
        timeStamp: new Date()
    });
});

router.get("/topics", sendTopicsPage);
router.get("/topics/", sendTopicsPage);
router.get("/topics/:topicSlug", sendTopicsPage);
router.get("/topics/:topicSlug/:subtopicSlug", sendTopicsPage);
router.get(/^\/topics\/.*$/, sendTopicsPage);
router.get("/profile", sendProfilePage);
router.get("/profile/", sendProfilePage);
router.get("/profile/:username", sendProfilePage);
router.get("/competitions/:id", sendCompetitionDetailPage);
router.get("/problems/:id", sendProblemSetDetailPage);

module.exports = router;
