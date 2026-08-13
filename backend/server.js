const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`QRank Server is running at http://localhost:${PORT}`);
});

// These only make sense in a long-lived process, so they live here rather than
// in app.js. On Vercel, the equivalent cleanup is triggered by a scheduled
// POST to /api/cron/cleanup instead (see vercel.json).
const { deleteExpiredPasswordResetCodes, deleteExpiredSessions } = require('./cleanup');

deleteExpiredPasswordResetCodes().catch(err => {
    console.error("Failed to clean up expired password reset codes:", err);
});

setInterval(() => {
    deleteExpiredPasswordResetCodes().catch(err => {
        console.error("Failed to clean up expired password reset codes:", err);
    });
}, 60 * 1000);

deleteExpiredSessions().catch(err => {
    console.error("Failed to clean up expired sessions:", err);
});

setInterval(() => {
    deleteExpiredSessions().catch(err => {
        console.error("Failed to clean up expired sessions:", err);
    });
}, 60 * 1000);
