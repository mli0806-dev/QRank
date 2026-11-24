const env = require('../env');

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function isCaptchaConfigured() {
    return Boolean(env.turnstile.siteKey && env.turnstile.secretKey);
}

async function verifyCaptcha(token, remoteIp) {
    if (!isCaptchaConfigured()) {
        return { success: true, skipped: true };
    }

    const cleanToken = String(token || "").trim();

    if (!cleanToken) {
        return { success: false, message: "Please complete the captcha." };
    }

    const body = new URLSearchParams({
        secret: env.turnstile.secretKey,
        response: cleanToken
    });

    if (remoteIp) {
        body.set("remoteip", remoteIp);
    }

    let outcome;

    try {
        const response = await fetch(VERIFY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
            signal: AbortSignal.timeout(8000)
        });

        outcome = await response.json();
    } catch (error) {
        console.error("Captcha verification request failed:", error);
        return { success: false, message: "Could not verify the captcha. Please try again." };
    }

    if (!outcome || outcome.success !== true) {
        console.warn("Captcha rejected:", outcome && outcome["error-codes"]);
        return { success: false, message: "Captcha verification failed. Please try again." };
    }

    return { success: true, skipped: false };
}

module.exports = { isCaptchaConfigured, verifyCaptcha };
