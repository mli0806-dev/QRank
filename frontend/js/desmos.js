import { insertTextAtCursor } from './core/dom.js';
import { getDesmosConfig, loadDesmosScript } from './desmos-render.js';

let desmosToolEnabled = false;
let desmosApiKeyValue = null;

async function initDesmosTool() {
    try {
        const data = await getDesmosConfig();

        if (!data) {
            return;
        }

        desmosToolEnabled = true;
        desmosApiKeyValue = data.apiKey;
        document.querySelectorAll(".desmostoolbutton").forEach((button) => button.classList.remove("hidden"));

        document.addEventListener("click", (event) => {
            const button = event.target.closest(".desmostoolbutton");
            if (!button) {
                return;
            }

            const textarea = resolveDesmosTargetTextarea(button);
            if (textarea) {
                openDesmosModal(textarea);
            }
        });
    } catch (error) {
        console.error("Failed to load Desmos config:", error);
    }
}

function resolveDesmosTargetTextarea(button) {
    const targetId = button.dataset.desmosTarget;
    if (targetId) {
        return document.getElementById(targetId);
    }

    const item = button.closest(".problemtakeitem");
    return item ? item.querySelector(".problem-prompt") : null;
}

function closeDesmosModal() {
    const existing = document.querySelector(".desmosmodaloverlay");
    if (existing) {
        existing.remove();
    }
}

function openDesmosModal(targetTextarea) {
    closeDesmosModal();

    const overlay = document.createElement("div");
    overlay.className = "desmosmodaloverlay";
    overlay.innerHTML = `
        <div class="desmosmodal">
            <div class="desmosmodalheader">
                <div class="desmosmodaltabs">
                    <button type="button" class="desmosmodaltab desmosmodaltabactive" data-desmos-mode="graph">Graph</button>
                    <button type="button" class="desmosmodaltab" data-desmos-mode="geometry">Geometry</button>
                </div>
                <button type="button" class="desmosmodalclose" aria-label="Close">&times;</button>
            </div>
            <div class="desmosmodalcalculator" id="desmosCalculatorMount"></div>
            <div class="desmosmodalstatus" id="desmosModalStatus"></div>
            <div class="desmosmodalactions">
                <button type="button" class="authsubmit" id="desmosInsertButton">Insert into problem</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    let calculator = null;
    let currentMode = "graph";

    async function mountCalculator(mode) {
        const mount = document.getElementById("desmosCalculatorMount");
        const status = document.getElementById("desmosModalStatus");
        if (!mount) {
            return;
        }

        currentMode = mode;
        mount.innerHTML = "";
        if (status) {
            status.textContent = "Loading Desmos...";
        }

        if (calculator) {
            calculator.destroy();
            calculator = null;
        }

        try {
            await loadDesmosScript(desmosApiKeyValue);
        } catch (error) {
            console.error("Failed to load Desmos:", error);
            if (status) {
                status.textContent = "Unable to load Desmos right now.";
            }
            return;
        }

        try {
            calculator = mode === "geometry"
                ? window.Desmos.Geometry(mount)
                : window.Desmos.GraphingCalculator(mount);

            if (status) {
                status.textContent = "";
            }
        } catch (error) {
            console.error("Failed to start Desmos:", error);
            if (status) {
                status.textContent = "Unable to load Desmos right now.";
            }
        }
    }

    overlay.querySelectorAll(".desmosmodaltab").forEach((tab) => {
        tab.addEventListener("click", () => {
            overlay.querySelectorAll(".desmosmodaltab").forEach((otherTab) => otherTab.classList.remove("desmosmodaltabactive"));
            tab.classList.add("desmosmodaltabactive");
            mountCalculator(tab.dataset.desmosMode);
        });
    });

    overlay.querySelector(".desmosmodalclose").addEventListener("click", closeDesmosModal);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeDesmosModal();
        }
    });

    document.getElementById("desmosInsertButton").addEventListener("click", () => {
        if (!calculator) {
            return;
        }

        const payload = JSON.stringify({ mode: currentMode, state: calculator.getState() });
        insertTextAtCursor(targetTextarea, `\n\`\`\`desmos\n${payload}\n\`\`\`\n`);
        closeDesmosModal();
    });

    mountCalculator("graph");
}

export { initDesmosTool, desmosToolEnabled };

