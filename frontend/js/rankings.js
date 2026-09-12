import { escapeHtml } from './core/dom.js';

function initUserSearch() {
    const form = document.getElementById("user-search-form");
    const input = document.getElementById("user-search");

    if (!form || !input) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const username = input.value.trim();

        if (!username) {
            return;
        }

        window.location.href = `/profile/${encodeURIComponent(username)}`;
    });
}

async function loadLeaderboard() {
    const list = document.querySelector(".leaderboardlist");

    if (!list) {
        return;
    }

    try {
        const response = await fetch("/api/leaderboard");
        const data = await response.json();

        if (!response.ok || !Array.isArray(data.leaderboard) || data.leaderboard.length === 0) {
            list.innerHTML = '<li class="leaderboardempty">No ranked users yet.</li>';
            return;
        }

        list.innerHTML = data.leaderboard.map((row) => `
            <li class="leaderboarditem">
                <span class="leaderboardplacement">#${escapeHtml(row.placement)}</span>
                <a class="leaderboardusername" href="/profile/${encodeURIComponent(row.username)}">${escapeHtml(row.username)}</a>
                <span class="leaderboardid">ID ${escapeHtml(row.displayId)}</span>
                <span class="leaderboardscore">${escapeHtml(row.qscore)} QScore</span>
            </li>
        `).join('');
    } catch (error) {
        console.error("Failed to load leaderboard:", error);
        list.innerHTML = '<li class="leaderboardempty">Unable to load the leaderboard right now.</li>';
    }
}

function initRankingsPage() {
    initUserSearch();
    loadLeaderboard();
}

export { initRankingsPage };
