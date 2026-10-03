let desmosConfigPromise = null;
let desmosScriptPromise = null;

function getDesmosConfig() {
    if (desmosConfigPromise) {
        return desmosConfigPromise;
    }

    desmosConfigPromise = fetch('/api/desmos-config')
        .then((response) => response.json())
        .then((data) => (data && data.enabled && data.apiKey ? data : null))
        .catch((error) => {
            console.error('Failed to load Desmos config:', error);
            return null;
        });

    return desmosConfigPromise;
}

function loadDesmosScript(apiKey) {
    if (window.Desmos) {
        return Promise.resolve();
    }

    if (desmosScriptPromise) {
        return desmosScriptPromise;
    }

    desmosScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
        script.onload = () => (window.Desmos ? resolve() : reject(new Error('Desmos failed to initialize.')));
        script.onerror = () => reject(new Error('Failed to load the Desmos script.'));
        document.head.appendChild(script);
    });

    return desmosScriptPromise;
}

function createStaticCalculator(mount, mode) {
    const options = {
        expressions: false,
        settingsMenu: false,
        zoomButtons: false,
        lockViewport: true,
        border: false
    };

    return mode === 'geometry'
        ? window.Desmos.Geometry(mount, options)
        : window.Desmos.GraphingCalculator(mount, options);
}

function parseDesmosBlock(raw) {
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && parsed.state ? parsed : null;
    } catch {
        return null;
    }
}

async function renderDesmosIn(root) {
    if (!root) {
        return;
    }

    const blocks = Array.from(root.querySelectorAll('code.language-desmos'));

    if (blocks.length === 0) {
        return;
    }

    const config = await getDesmosConfig();

    if (!config) {
        return;
    }

    try {
        await loadDesmosScript(config.apiKey);
    } catch (error) {
        console.error('Failed to load Desmos:', error);
        return;
    }

    blocks.forEach((block) => {
        const parsed = parseDesmosBlock(block.textContent);
        const host = block.closest('pre') || block;

        if (!parsed) {
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'desmosfigure';
        host.replaceWith(wrapper);

        try {
            createStaticCalculator(wrapper, parsed.mode).setState(parsed.state);
        } catch (error) {
            console.error('Failed to render Desmos graph:', error);
        }
    });
}

export { getDesmosConfig, loadDesmosScript, renderDesmosIn };
