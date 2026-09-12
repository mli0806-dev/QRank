const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const REQUIRED_ENV_VARS = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'COOKIE_SECRET', 'CRON_SECRET'];
const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

if (missingEnvVars.length > 0) {
    console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
}

module.exports = {
    port: process.env.PORT || 3000,
    cookieSecret: process.env.COOKIE_SECRET,
    cronSecret: process.env.CRON_SECRET,
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    desmosApiKey: (process.env.DESMOS_API_KEY || "").trim(),
    resetCodeTtlMinutes: parseInt(process.env.RESET_CODE_TTL_MINUTES || "15", 10),
    allowDevEmailFallback: process.env.NODE_ENV !== "production" && process.env.DEV_PASSWORD_RESET_FALLBACK === "true",
    smtp: {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
        from: process.env.SMTP_FROM
    }
};
