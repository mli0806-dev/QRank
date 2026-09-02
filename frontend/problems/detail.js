async function loadProblemSetDetail() {
    const container = document.getElementById("problemsetdetailcontainer");

    if (!container) {
        return;
    }

    const parts = window.location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const problemSetId = parts[1];

    if (!problemSetId) {
        container.innerHTML = `
            <div class="problemsetdetailleft">
                <a class="topicdetailback" href="/problems/">Back to Problem Sets</a>
                <h1 class="topicdetailtitle">Problem set not found</h1>
                <p class="topicdetailtext">No problem set ID was provided.</p>
            </div>
        `;
        return;
    }

    try {
        const response = await fetch(`/api/problem-sets/${encodeURIComponent(problemSetId)}`);

        if (!response.ok) {
            container.innerHTML = `
                <div class="problemsetdetailleft">
                    <a class="topicdetailback" href="/problems/">Back to Problem Sets</a>
                    <h1 class="topicdetailtitle">Problem set not found</h1>
                    <p class="topicdetailtext">We couldn't find that problem set.</p>
                </div>
            `;
            return;
        }

        const { problemSet, problems } = await response.json();
        renderProblemSetDetail(container, problemSetId, problemSet, problems);
        initProblemSetEditButton(problemSetId);
    } catch (error) {
        console.error("Failed to load problem set:", error);
        container.innerHTML = `
            <div class="problemsetdetailleft">
                <a class="topicdetailback" href="/problems/">Back to Problem Sets</a>
                <h1 class="topicdetailtitle">Problem set unavailable</h1>
                <p class="topicdetailtext">Unable to load this problem set right now.</p>
            </div>
        `;
    }
}

function renderProblemSetDetail(container, problemSetId, problemSet, problems) {
    const tocHtml = problems.length
        ? `
            <div class="problemtoc">
                ${problems.map((problem, index) => `
                    <button type="button" class="problemtocitem" data-problem-index="${index}">${index + 1}</button>
                `).join('')}
            </div>
        `
        : '';

    const problemsHtml = problems.length
        ? problems.map((problem, index) => renderProblem(problem, index, problems.length)).join('')
        : '<p class="topicdetailtext">This problem set has no problems yet.</p>';

    container.innerHTML = `
        <div class="problemsetdetailleft">
            <a class="topicdetailback" href="/problems/">Back to Problem Sets</a>
            <h1 class="topicdetailtitle">${escapeHtml(problemSet.name)}</h1>
            <button type="button" id="edit-problem-set-button" class="topicdetailback hidden">Edit this problem set</button>
            <div class="topicdetailtext">${renderMarkdown(problemSet.description, "No description available yet.")}</div>
            ${problemSet.calculatorAllowed ? '<p class="tag">Calculator approved</p>' : ''}
            ${tocHtml}
        </div>
        <div class="problemsetdetailright">
            ${problemsHtml}
        </div>
    `;

    renderMathIn(container);

    problems.forEach((problem) => {
        const form = document.getElementById(`problemtakeform-${problem.id}`);
        if (form) {
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                checkSingleProblem(problemSetId, problem);
            });
        }
    });

    initProblemToc(problems);
    initProblemNav(problems);
}

let currentProblemIndex = 0;

function showProblem(problems, activeIndex) {
    currentProblemIndex = activeIndex;

    problems.forEach((problem, index) => {
        const form = document.getElementById(`problemtakeform-${problem.id}`);
        if (form) {
            form.classList.toggle("hidden", index !== activeIndex);
        }
    });

    document.querySelectorAll(".problemtocitem").forEach((button) => {
        const index = Number(button.dataset.problemIndex);
        button.classList.toggle("problemtocitemactive", index === activeIndex);
    });
}

function initProblemToc(problems) {
    document.querySelectorAll(".problemtocitem").forEach((button) => {
        button.addEventListener("click", () => {
            showProblem(problems, Number(button.dataset.problemIndex));
        });
    });

    if (problems.length) {
        showProblem(problems, 0);
    }
}

function initProblemNav(problems) {
    document.querySelectorAll('[data-nav="prev"]').forEach((button) => {
        button.addEventListener("click", () => {
            if (currentProblemIndex > 0) {
                showProblem(problems, currentProblemIndex - 1);
            }
        });
    });

    document.querySelectorAll('[data-nav="next"]').forEach((button) => {
        button.addEventListener("click", () => {
            if (currentProblemIndex < problems.length - 1) {
                showProblem(problems, currentProblemIndex + 1);
            }
        });
    });
}

// Reuses the suggestion/review pipeline as the edit mechanism for already-live
// problem sets: clones this problem set into a new pending suggestion, then
// sends the admin to the same contribute form (in edit mode) to change it.
async function initProblemSetEditButton(problemSetId) {
    const button = document.getElementById("edit-problem-set-button");
    if (!button) {
        return;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
        return;
    }

    button.classList.remove("hidden");
    button.addEventListener("click", async () => {
        button.disabled = true;
        button.textContent = "Preparing edit...";

        try {
            const response = await fetch(`/api/admin/problem-sets/${encodeURIComponent(problemSetId)}/edit`, {
                method: "POST"
            });
            const data = await response.json();

            if (!response.ok) {
                button.disabled = false;
                button.textContent = data.message || "Unable to start editing.";
                return;
            }

            window.location.href = `/contribute/?editSuggestion=${encodeURIComponent(data.suggestionId)}`;
        } catch (error) {
            console.error("Failed to start editing problem set:", error);
            button.disabled = false;
            button.textContent = "Unable to start editing.";
        }
    });
}

function renderProblem(problem, index, total) {
    const number = index + 1;
    const choices = Array.isArray(problem.choices) ? problem.choices : [];

    const inputHtml = problem.type === "multiple_choice"
        ? choices.map((choice, choiceIndex) => `
            <label class="problemtakechoice">
                <input type="radio" name="problem-${problem.id}" value="${escapeHtml(choice)}" class="problemtakechoiceinput">
                <span class="problemtakechoiceletter">${String.fromCharCode(65 + choiceIndex)}</span>
                <span class="problemtakechoicetext">${escapeHtml(choice)}</span>
            </label>
        `).join('')
        : `<input type="text" class="inputs" id="problem-input-${problem.id}" name="problem-${problem.id}" placeholder="Your answer" autocomplete="off">`;

    return `
        <form class="problemtakeitem" id="problemtakeform-${problem.id}">
            <div class="problemtakeprompt"><span class="problemtakenumber">${number}.</span> ${renderMarkdown(problem.prompt, "")}</div>
            <div class="problemtakeinput">${inputHtml}</div>
            <button type="submit" class="authsubmit">Check</button>
            <p class="problemtakefeedback"></p>
            <div class="problemtakenav">
                ${index === 0 ? "" : '<button type="button" class="topicdetailback" data-nav="prev">Previous problem</button>'}
                ${index === total - 1 ? "" : '<button type="button" class="topicdetailback" data-nav="next">Next problem</button>'}
            </div>
        </form>
    `;
}

function getSubmittedAnswer(problem) {
    if (problem.type === "multiple_choice") {
        const checked = document.querySelector(`input[name="problem-${problem.id}"]:checked`);
        return checked ? checked.value : "";
    }

    const input = document.getElementById(`problem-input-${problem.id}`);
    return input ? input.value : "";
}

async function checkSingleProblem(problemSetId, problem) {
    const item = document.getElementById(`problemtakeform-${problem.id}`);
    const feedback = item ? item.querySelector(".problemtakefeedback") : null;

    if (feedback) {
        feedback.textContent = "Checking...";
    }

    const answer = getSubmittedAnswer(problem);

    try {
        const response = await fetch(`/api/problem-sets/${encodeURIComponent(problemSetId)}/check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ answers: { [problem.id]: answer } })
        });

        if (!response.ok) {
            if (feedback) {
                feedback.textContent = "Unable to check this answer right now.";
            }
            return;
        }

        const { results, pointsAwarded } = await response.json();
        const isCorrect = Boolean(results[problem.id]);

        if (feedback) {
            feedback.textContent = isCorrect && pointsAwarded
                ? `Correct (+${pointsAwarded} QScore)`
                : (isCorrect ? "Correct" : "Incorrect");
        }
        if (item) {
            item.classList.toggle("problemtakecorrect", isCorrect);
            item.classList.toggle("problemtakeincorrect", !isCorrect);
        }
    } catch (error) {
        console.error("Failed to check answer:", error);
        if (feedback) {
            feedback.textContent = "Unable to check this answer right now.";
        }
    }
}

document.addEventListener("DOMContentLoaded", loadProblemSetDetail);
