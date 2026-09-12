let desmosToolEnabled = false;
let desmosApiKeyValue = null;
let desmosScriptPromise = null;

function loadDesmosScript(apiKey) {
    if (window.Desmos) {
        return Promise.resolve();
    }

    if (desmosScriptPromise) {
        return desmosScriptPromise;
    }

    desmosScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
        script.onload = () => {
            if (window.Desmos) {
                resolve();
            } else {
                reject(new Error("Desmos failed to initialize."));
            }
        };
        script.onerror = () => reject(new Error("Failed to load the Desmos script."));
        document.head.appendChild(script);
    });

    return desmosScriptPromise;
}

async function initDesmosTool() {
    try {
        const response = await fetch("/api/desmos-config");
        const data = await response.json();

        if (!response.ok || !data.enabled || !data.apiKey) {
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

function insertTextAtCursor(textarea, text) {
    if (!textarea) {
        return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    textarea.focus();

    const cursor = start + text.length;
    textarea.setSelectionRange(cursor, cursor);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
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

    async function mountCalculator(mode) {
        const mount = document.getElementById("desmosCalculatorMount");
        const status = document.getElementById("desmosModalStatus");
        if (!mount) {
            return;
        }

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

        const insertImage = (dataUri) => {
            if (!dataUri) {
                return;
            }
            insertTextAtCursor(targetTextarea, `\n![Desmos graph](${dataUri})\n`);
            closeDesmosModal();
        };

        if (typeof calculator.screenshot === "function") {
            insertImage(calculator.screenshot({ width: 600, height: 400 }));
        } else if (typeof calculator.asyncScreenshot === "function") {
            calculator.asyncScreenshot({ width: 600, height: 400 }, insertImage);
        }
    });

    mountCalculator("graph");
}

export { initDesmosTool, desmosToolEnabled };

