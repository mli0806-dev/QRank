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
        const response = await fetch(`/api/competitions/${encodeURIComponent(competitionId)}`);

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
            <div class="topicdetailpanel">
                <p class="topicdetailtext"><span>Category:</span> ${escapeHtml(competition.category || "Uncategorized")}</p>
                <p class="topicdetailtext"><span>Dates:</span> ${escapeHtml(competition.start_date)} to ${escapeHtml(competition.end_date)}</p>
                <p class="topicdetailtext"><span>Time:</span> ${escapeHtml(competition.start_time)} - ${escapeHtml(competition.end_time)}</p>
            </div>
        `;
    } catch (error) {
        console.error("Failed to load competition:", error);
        container.innerHTML = `
            <a class="topicdetailback" href="/competitions/">Back to Competitions</a>
            <h1 class="topicdetailtitle">Competition unavailable</h1>
            <p class="topicdetailtext">Unable to load this competition right now.</p>
        `;
    }
}

document.addEventListener("DOMContentLoaded", loadCompetitionDetail);
