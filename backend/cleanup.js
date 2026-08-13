const db = require('./config/db');

async function deleteExpiredPasswordResetCodes() {
    const [result] = await db.query(
        "DELETE FROM password_reset_codes WHERE expires_at <= NOW()"
    );

    if (result && result.affectedRows > 0) {
        console.log(`Removed ${result.affectedRows} expired password reset code(s).`);
    }
}

async function deleteExpiredSessions() {
    const [result] = await db.query(
        "DELETE FROM sessions WHERE expires_at <= NOW()"
    );

    if (result && result.affectedRows > 0) {
        console.log(`Removed ${result.affectedRows} expired session(s).`);
    }
}

module.exports = { deleteExpiredPasswordResetCodes, deleteExpiredSessions };
