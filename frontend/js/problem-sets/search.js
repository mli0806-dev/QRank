import { escapeHtml, renderMarkdown } from '../core/dom.js';

function renderProblemSetCard(problemSet, options = {}) {
    const { showBreadcrumb = false, showCalculatorTag = false } = options;
    const breadcrumb = showBreadcrumb
        ? `<p class="problemsetmeta">${escapeHtml([problemSet.topic, problemSet.subtopic, problemSet.unit].filter(Boolean).join(" / ") || "Topic not assigned")}</p>`
        : '';
    const calculatorTag = showCalculatorTag && problemSet.calculatorAllowed
        ? '<p class="tag">Calculator approved</p>'
        : '';

    return `
        <a class="problemsetcard" href="/problems/${encodeURIComponent(problemSet.id)}">
            <p class="problemsetid">Problem Set ID #${escapeHtml(problemSet.id)}</p>
            <h2>${escapeHtml(problemSet.name)}</h2>
            <div>${renderMarkdown(problemSet.description, "No description available yet.")}</div>
            ${breadcrumb}${calculatorTag}<div class="problemsettags">
                ${(problemSet.tags || []).map((tag) => `<span class="problemsettag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        </a>
    `;
}

function renderProblemSetResults(problemSets, searchTerm = "") {
    const container = document.getElementById("problem-set-results");

    if (!container) {
        return;
    }

    if (!problemSets.length) {
        container.innerHTML = `
            <div class="problemsetempty">
                <h2>No problem sets available yet</h2>
                <p>${searchTerm ? `No matches found for “${escapeHtml(searchTerm)}”.` : "New problem-set collections will appear here once they are added to the database."}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="problemsetlist">
            ${problemSets.map((problemSet) => renderProblemSetCard(problemSet, { showBreadcrumb: true, showCalculatorTag: true })).join('')}
        </div>
    `;
}

async function loadProblemSets(searchTerm = "") {
    const container = document.getElementById("problem-set-results");

    if (!container) {
        return;
    }

    container.innerHTML = '<div class="problemsetempty"><p>Loading problem sets...</p></div>';

    try {
        const response = await fetch(`/api/problem-sets?search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const problemSets = await response.json();
        renderProblemSetResults(problemSets, searchTerm);
    } catch (error) {
        console.error("Failed to load problem sets:", error);
        container.innerHTML = '<div class="problemsetempty"><p>Unable to load problem sets right now.</p></div>';
    }
}

function initProblemSetSearch() {
    const form = document.getElementById("problem-set-search-form");
    const input = document.getElementById("problem-set-search");

    if (!form || !input) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        loadProblemSets(input.value.trim());
    });

    loadProblemSets("");
}

export { renderProblemSetCard, initProblemSetSearch };
