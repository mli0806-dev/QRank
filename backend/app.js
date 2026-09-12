const path = require('path');
const env = require('./env');

const express = require("express");
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const app = express();
const frontendPath = path.join(__dirname, '../frontend');
const notFoundPagePath = path.join(frontendPath, '404/index.html');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://accounts.google.com", "https://www.desmos.com", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.cdnfonts.com", "https://www.desmos.com", "https://accounts.google.com"],
            imgSrc: ["'self'", "data:", "https://accounts.google.com", "https://*.googleusercontent.com", "https://www.desmos.com"],
            fontSrc: ["'self'", "data:", "https://fonts.cdnfonts.com", "https://www.desmos.com"],
            connectSrc: ["'self'", "https://accounts.google.com", "https://www.desmos.com"],
            workerSrc: ["'self'", "blob:"],
            frameSrc: ["https://accounts.google.com", "https://doq.world"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"]
        }
    },
    hsts: { maxAge: 63072000, includeSubDomains: true },
    crossOriginResourcePolicy: { policy: "same-site" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

app.use((req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
    next();
});

app.use(express.static(frontendPath, {
    setHeaders: (res, filePath) => {
        if (/\.(png|jpe?g|webp|svg|gif|ico)$/i.test(filePath)) {
            res.setHeader("Cache-Control", "public, max-age=604800");
        }
    }
}));
app.use(express.json());
app.use(cookieParser(env.cookieSecret));

app.use(require('./routes/misc'));
app.use(require('./routes/auth'));
app.use(require('./routes/problemSets'));
app.use(require('./routes/suggestions'));
app.use(require('./routes/topics'));
app.use(require('./routes/users'));
app.use(require('./routes/competitions'));
app.use(require('./routes/leaderboard'));

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
