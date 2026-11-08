import { injectHeaderFooter, initMobileNav } from './header-footer.js';
import { initTheme } from './theme.js';
import { checkUserStatus } from './auth-state.js';
import { initPasswordToggles } from './password-toggle.js';

async function pingServer() {
    try {
        await fetch('/api/status');
    } catch (error) {
        console.error("Failed to connect to the backend:", error);
    }
}

function loadVercelSpeedInsights() {
    const script = document.createElement("script");
    script.defer = true;
    script.src = "/_vercel/speed-insights/script.js";
    document.head.appendChild(script);
}

function initCorePage() {
    loadVercelSpeedInsights();
    injectHeaderFooter();
    initTheme();
    initMobileNav();
    checkUserStatus();
    initPasswordToggles();
    pingServer();
}

export { initCorePage };
