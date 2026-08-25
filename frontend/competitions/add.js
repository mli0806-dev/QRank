function populateTimeSelects(prefix) {
    const hourSelect = document.getElementById(`competition-${prefix}-hour`);
    const minuteSelect = document.getElementById(`competition-${prefix}-minute`);

    if (hourSelect) {
        for (let hour = 1; hour <= 12; hour += 1) {
            const option = document.createElement("option");
            option.value = String(hour);
            option.textContent = String(hour);
            hourSelect.appendChild(option);
        }
    }

    if (minuteSelect) {
        for (let minute = 0; minute < 60; minute += 1) {
            const value = String(minute).padStart(2, "0");
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            minuteSelect.appendChild(option);
        }
    }
}

function readTimeSelect(prefix) {
    const hour = document.getElementById(`competition-${prefix}-hour`).value;
    const minute = document.getElementById(`competition-${prefix}-minute`).value;
    const ampm = document.getElementById(`competition-${prefix}-ampm`).value;

    if (!hour || !minute || !ampm) {
        return null;
    }

    let hour24 = parseInt(hour, 10) % 12;
    if (ampm === "PM") {
        hour24 += 12;
    }

    return `${String(hour24).padStart(2, "0")}:${minute}`;
}

async function initAddCompetitionPage() {
    const currentUser = await getCurrentUser();
    const subtext = document.getElementById("add-competition-subtext");

    if (!currentUser || (currentUser.role !== "verified" && currentUser.role !== "admin")) {
        const panel = document.querySelector(".aboutuspanel");
        if (subtext) {
            subtext.textContent = "You need a verified account to add competitions.";
        }
        if (panel) {
            panel.innerHTML = `<p class="topicdetailtext">Only verified accounts can add competitions. Contact an admin if you think you should have access.</p>`;
        }
        return;
    }

    const form = document.getElementById("add-competition-form");
    const addProblemButton = document.getElementById("add-problem-button");
    const statusElement = document.getElementById("add-competition-status");

    if (addProblemButton) {
        addProblemButton.addEventListener("click", addProblemItem);
    }

    initMarkdownToolbar(".markdownbutton[data-markdown]", document.getElementById("competition-problemset-description"));
    initDesmosTool();
    addProblemItem();
    populateTimeSelects("start");
    populateTimeSelects("end");

    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();

            if (!statusElement) {
                return;
            }

            const problems = serializeProblemItems();
            if (!problems.length) {
                statusElement.textContent = "Please add at least one problem.";
                return;
            }

            const startTime = readTimeSelect("start");
            const endTime = readTimeSelect("end");

            if (!startTime || !endTime) {
                statusElement.textContent = "Please select a full start time and end time.";
                return;
            }

            const payload = {
                title: document.getElementById("competition-title").value.trim(),
                category: document.getElementById("competition-category").value.trim(),
                startDate: document.getElementById("competition-start-date").value,
                endDate: document.getElementById("competition-end-date").value,
                startTime,
                endTime,
                isPrivate: document.getElementById("competition-private").checked,
                problemSetName: document.getElementById("competition-problemset-name").value.trim(),
                problemSetDescription: document.getElementById("competition-problemset-description").value.trim(),
                problems
            };

            if (!payload.title || !payload.startDate || !payload.endDate) {
                statusElement.textContent = "Please complete all required fields.";
                return;
            }

            statusElement.textContent = "Creating competition...";

            try {
                const response = await fetch("/api/competitions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (!response.ok) {
                    statusElement.textContent = data.message || "Unable to create competition.";
                    return;
                }

                const destination = data.isPrivate
                    ? `/competitions/${encodeURIComponent(data.competitionId)}?code=${encodeURIComponent(data.joinCode)}`
                    : `/competitions/${encodeURIComponent(data.competitionId)}`;

                window.location.href = destination;
            } catch (error) {
                console.error("Failed to create competition:", error);
                statusElement.textContent = "Unable to create competition right now.";
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", initAddCompetitionPage);
