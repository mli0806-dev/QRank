const nodemailer = require('nodemailer');
const env = require('../env');

const mailerReady = Boolean(env.smtp.host && env.smtp.user && env.smtp.pass && env.smtp.from);

const mailer = mailerReady
    ? nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.secure,
        auth: {
            user: env.smtp.user,
            pass: env.smtp.pass
        }
    })
    : null;

async function sendPasswordResetEmail(email, username, code) {
    if (!mailer) {
        throw new Error("SMTP is not configured.");
    }

    await mailer.sendMail({
        from: env.smtp.from,
        to: email,
        subject: "QRank password reset code",
        text: `Hi ${username}, your QRank verification code is ${code}. It expires in ${env.resetCodeTtlMinutes} minutes.`
    });
}

async function sendPasswordChangedNotification(email, username) {
    if (!mailer) {
        return;
    }

    await mailer.sendMail({
        from: env.smtp.from,
        to: email,
        subject: "Your QRank password was changed",
        text: `Hi ${username}, your QRank account password was just changed. If this wasn't you, please reset your password again immediately.`
    });
}

module.exports = { mailerReady, sendPasswordResetEmail, sendPasswordChangedNotification };
