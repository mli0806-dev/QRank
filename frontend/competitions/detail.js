async function loadCompetitionDetail() {
    const container = document.getElementById("competitiondetailcontainer");

    if (!container) {
        return;
    }

    const parts = window.location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const competitionId = parts[1];

    if (!competitionId) {
        container.innerHTML = `
            <a class="topicdetailback" href="/competitions/">Back to Competitions</a>
            <h1 class="topicdetailtitle">Competition not found</h1>
            <p class="topicdetailtext">No competition ID was provided.</p>
        `;
        return;
    }

    try {
        const code = new URLSearchParams(window.location.search).get("code") || "";
        const response = await fetch(`/api/competitions/${encodeURIComponent(competitionId)}${code ? `?code=${encodeURIComponent(code)}` : ""}`);

        if (!response.ok) {
            container.innerHTML = `
                <a class="topicdetailback" href="/competitions/">Back to Competitions</a>
                <h1 class="topicdetailtitle">Competition not found</h1>
                <p class="topicdetailtext">We couldn't find that competition.</p>
            `;
            return;
        }

        const competition = await response.json();

        container.innerHTML = `
            <a class="topicdetailback" href="/competitions/">Back to Competitions</a>
            <h1 class="topicdetailtitle">${escapeHtml(competition.title)}</h1>
            <button type="button" id="save-competition-button" class="topicdetailback hidden">Save this competition</button>
            <div class="topicdetailpanel competitiondetailpanel">
                <p class="topicdetailtext"><span>Category:</span> ${escapeHtml(competition.category || "Uncategorized")}</p>
                <p class="topicdetailtext"><span>Dates:</span> ${escapeHtml(competition.startDate)} to ${escapeHtml(competition.endDate)}</p>
                <p class="topicdetailtext"><span>Time:</span> ${escapeHtml(competition.startTime)} - ${escapeHtml(competition.endTime)}</p>
                ${competition.isPrivate ? `<p class="topicdetailtext"><span>Invite code:</span> ${escapeHtml(competition.joinCode)}</p>` : ''}
            </div>
            ${competition.problemSetId ? `<a class="topicdetailback competitiontakelink" href="/problems/${encodeURIComponent(competition.problemSetId)}">Take this competition's problem set</a>` : ''}
        `;

        initSaveCompetitionButton(competitionId);
    } catch (error) {
        console.error("Failed to load competition:", error);
        container.innerHTML = `
            <a class="topicdetailback" href="/competitions/">Back to Competitions</a>
            <h1 class="topicdetailtitle">Competition unavailable</h1>
            <p class="topicdetailtext">Unable to load this competition right now.</p>
        `;
    }
}

async function initSaveCompetitionButton(competitionId) {
    const button = document.getElementById("save-competition-button");
    if (!button) {
        return;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return;
    }

    let saved = false;
    try {
        const response = await fetch("/api/saved-competitions");
        if (response.ok) {
            const savedCompetitions = await response.json();
            saved = savedCompetitions.some((competition) => String(competition.id) === String(competitionId));
        }
    } catch (error) {
        console.error("Failed to check saved competitions:", error);
    }

    const render = () => {
        button.textContent = saved ? "Unsave this competition" : "Save this competition";
    };
    render();
    button.classList.remove("hidden");

    button.addEventListener("click", async () => {
        button.disabled = true;

        try {
            const response = await fetch(`/api/competitions/${encodeURIComponent(competitionId)}/save`, {
                method: saved ? "DELETE" : "POST"
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                console.error("Failed to toggle saved competition:", data.message);
                return;
            }

            saved = !saved;
            render();
        } catch (error) {
            console.error("Failed to toggle saved competition:", error);
        } finally {
            button.disabled = false;
        }
    });
}

document.addEventListener("DOMContentLoaded", loadCompetitionDetail);
