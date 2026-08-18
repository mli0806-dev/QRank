async function loadSuggestions() {
    const container = document.getElementById("suggestionslist");
    if (!container) {
        return;
    }

    try {
        const response = await fetch("/api/admin/problem-set-suggestions");

        if (response.status === 401) {
            container.innerHTML = `<p>Not logged in. <a href="/login/">Log in</a> with an admin account.</p>`;
            return;
        }

        if (response.status === 403) {
            container.innerHTML = `<p>Your account isn't authorized to view this.</p>`;
            return;
        }

        if (!response.ok) {
            container.innerHTML = `<p>Failed to load suggestions.</p>`;
            return;
        }

        const { suggestions } = await response.json();
        renderSuggestions(container, suggestions);
    } catch (error) {
        console.error("Failed to load suggestions:", error);
        container.innerHTML = `<p>Failed to load suggestions.</p>`;
    }
}

function renderSuggestions(container, suggestions) {
    if (!suggestions.length) {
        container.innerHTML = `<p>No suggestions submitted yet.</p>`;
        return;
    }

    container.innerHTML = suggestions.map(renderSuggestion).join('');

    suggestions.forEach((suggestion) => {
        const card = document.getElementById(`suggestion-${suggestion.id}`);
        if (!card) {
            return;
        }

        card.querySelectorAll("[data-status-action]").forEach((button) => {
            button.addEventListener("click", () => {
                updateSuggestionStatus(suggestion.id, button.dataset.statusAction);
            });
        });
    });
}

function renderSuggestion(suggestion) {
    const problemsHtml = suggestion.problems.length
        ? suggestion.problems.map((problem, index) => `
            <div class="suggestionproblem">
                <p><strong>${index + 1}. [${escapeHtml(problem.type || "")}]</strong> ${escapeHtml(problem.prompt || "")}</p>
                ${Array.isArray(problem.choices) && problem.choices.length
                    ? `<p>Choices: ${problem.choices.map(escapeHtml).join(', ')}</p>`
                    : ''}
                <p>Answer: ${escapeHtml(problem.answer || "")}</p>
            </div>
        `).join('')
        : '<p>No problems attached.</p>';

    return `
        <div class="suggestioncard" id="suggestion-${suggestion.id}">
            <p><strong>${escapeHtml(suggestion.name)}</strong> — ${escapeHtml(suggestion.topic)} / ${escapeHtml(suggestion.subtopic)}</p>
            <p>Status: <span class="suggestionstatus">${escapeHtml(suggestion.status)}</span></p>
            <p class="suggestionlivelink">${renderLiveLink(suggestion.createdProblemSetId)}</p>
            <p>Submitted by: ${escapeHtml(suggestion.submitter || "anonymous")} on ${escapeHtml(new Date(suggestion.createdAt).toLocaleString())}</p>
            <p>${escapeHtml(suggestion.description || "No description.")}</p>
            <p>Tags: ${suggestion.tags.length ? suggestion.tags.map(escapeHtml).join(', ') : "none"}</p>
            ${problemsHtml}
            <div class="suggestionactions">
                <button type="button" data-status-action="approved">Approve</button>
                <button type="button" data-status-action="rejected">Reject</button>
                <button type="button" data-status-action="reviewed">Mark reviewed</button>
            </div>
        </div>
    `;
}

function renderLiveLink(problemSetId) {
    return problemSetId
        ? `Live at: <a href="/problems/${encodeURIComponent(problemSetId)}" target="_blank" rel="noopener">/problems/${escapeHtml(problemSetId)}</a>`
        : '';
}

async function updateSuggestionStatus(id, status) {
    try {
        const response = await fetch(`/api/admin/problem-set-suggestions/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        const card = document.getElementById(`suggestion-${id}`);

        // Rejected suggestions are deleted server-side, so the card should just
        // disappear rather than show a "rejected" status on a record that no
        // longer exists.
        if (data.deleted) {
            if (card) {
                card.remove();
            }
            const container = document.getElementById("suggestionslist");
            if (container && !container.querySelector(".suggestioncard")) {
                container.innerHTML = '<p>No suggestions submitted yet.</p>';
            }
            return;
        }

        const statusLabel = card ? card.querySelector(".suggestionstatus") : null;
        const liveLink = card ? card.querySelector(".suggestionlivelink") : null;

        if (statusLabel) {
            statusLabel.textContent = status;
        }
        if (liveLink) {
            liveLink.innerHTML = renderLiveLink(data.createdProblemSetId);
        }
    } catch (error) {
        console.error("Failed to update suggestion status:", error);
    }
}

document.addEventListener("DOMContentLoaded", loadSuggestions);
