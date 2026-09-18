import { escapeHtml, renderMarkdown, renderMathIn } from '/js/core/dom.js';
import { getCurrentUser } from '/js/core/auth-state.js';
import { renderChoiceInputs } from '/js/problem-sets/choice-render.js';

async function loadProblemSetDetail() {
    const container = document.getElementById("problemsetdetailcontainer");

    if (!container) {
        return;
    }

    const parts = window.location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const problemSetId = parts[1];
    const targetProblemId = new URLSearchParams(window.location.search).get("problem");

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
        renderProblemSetDetail(container, problemSetId, problemSet, problems, targetProblemId);
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

function renderProblemSetDetail(container, problemSetId, problemSet, problems, targetProblemId) {
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
            initProblemAnswerState(problem, form);
            initProblemExplainButton(form);
        }
    });

    initProblemToc(problems, targetProblemId);
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

function initProblemToc(problems, targetProblemId) {
    document.querySelectorAll(".problemtocitem").forEach((button) => {
        button.addEventListener("click", () => {
            showProblem(problems, Number(button.dataset.problemIndex));
        });
    });

    if (problems.length) {
        const targetIndex = targetProblemId
            ? problems.findIndex((problem) => problem.id === Number(targetProblemId))
            : -1;
        showProblem(problems, targetIndex >= 0 ? targetIndex : 0);
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

    const inputHtml = problem.type === "multiple_choice"
        ? renderChoiceInputs(problem, { interactive: true, namePrefix: `problem-${problem.id}` })
        : `<input type="text" class="inputs" id="problem-input-${problem.id}" name="problem-${problem.id}" placeholder="Your answer" autocomplete="off">`;

    const explainButtonHtml = problem.hasExplanation
        ? '<button type="button" class="topicdetailback problemtakeexplainbutton" disabled>Explain</button>'
        : "";

    return `
        <form class="problemtakeitem" id="problemtakeform-${problem.id}">
            <div class="problemtakeprompt"><span class="problemtakenumber">${number}.</span> <span class="problemtakeid">#${escapeHtml(problem.id)}</span> ${renderMarkdown(problem.prompt, "")}</div>
            <div class="problemtakeinput">${inputHtml}</div>
            <button type="submit" class="authsubmit" disabled>Check</button>
            <p class="problemtakefeedback"></p>
            <div class="problemtakenav">
                ${index === 0 ? "" : '<button type="button" class="topicdetailback" data-nav="prev">Previous problem</button>'}
                <div class="problemtakenavright">
                    ${explainButtonHtml}
                    ${index === total - 1 ? "" : '<button type="button" class="topicdetailback" data-nav="next">Next problem</button>'}
                </div>
            </div>
            ${problem.hasExplanation ? '<p class="problemtakeexplanation hidden"></p>' : ""}
        </form>
    `;
}

function initProblemAnswerState(problem, form) {
    const submitButton = form.querySelector(".authsubmit");
    if (!submitButton) {
        return;
    }

    const updateState = () => {
        submitButton.disabled = getSubmittedAnswer(problem).trim() === "";
    };

    if (problem.type === "multiple_choice") {
        form.querySelectorAll(".problemtakechoiceinput").forEach((input) => {
            input.addEventListener("change", updateState);
        });
    } else {
        const input = form.querySelector(`#problem-input-${problem.id}`);
        if (input) {
            input.addEventListener("input", updateState);
        }
    }

    updateState();
}

function initProblemExplainButton(form) {
    const explainButton = form.querySelector(".problemtakeexplainbutton");
    const explanationEl = form.querySelector(".problemtakeexplanation");
    if (!explainButton || !explanationEl) {
        return;
    }

    explainButton.addEventListener("click", () => {
        const nowHidden = explanationEl.classList.toggle("hidden");
        explainButton.textContent = nowHidden ? "Explain" : "Hide Explanation";
    });
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

        const { results, correctAnswers, explanations, pointsAwarded } = await response.json();
        const isCorrect = Boolean(results[problem.id]);

        const explainButton = item ? item.querySelector(".problemtakeexplainbutton") : null;
        const explanationEl = item ? item.querySelector(".problemtakeexplanation") : null;
        const explanationText = explanations ? explanations[problem.id] : undefined;

        if (explainButton && explanationEl && typeof explanationText === "string" && explanationText.trim() !== "") {
            explainButton.disabled = false;
            explanationEl.innerHTML = renderMarkdown(explanationText, "");
            renderMathIn(explanationEl);
        }

        if (feedback) {
            feedback.textContent = isCorrect && pointsAwarded
                ? `Correct (+${pointsAwarded} QScore)`
                : (isCorrect ? "Correct" : "Incorrect");
        }
        if (item) {
            if (problem.type === "multiple_choice") {
                const correctAnswerRaw = correctAnswers ? correctAnswers[problem.id] : undefined;
                const normalizedCorrect = typeof correctAnswerRaw === "string"
                    ? correctAnswerRaw.trim().toLowerCase()
                    : null;

                item.querySelectorAll(".problemtakechoice").forEach((choiceEl) => {
                    choiceEl.classList.remove("problemtakechoicecorrect", "problemtakechoiceincorrect");

                    const radio = choiceEl.querySelector(".problemtakechoiceinput");
                    if (!radio) {
                        return;
                    }

                    if (normalizedCorrect !== null && radio.value.trim().toLowerCase() === normalizedCorrect) {
                        choiceEl.classList.add("problemtakechoicecorrect");
                    }
                    if (radio.checked && !isCorrect) {
                        choiceEl.classList.add("problemtakechoiceincorrect");
                    }
                });
            } else {
                item.classList.toggle("problemtakecorrect", isCorrect);
                item.classList.toggle("problemtakeincorrect", !isCorrect);
            }
        }
    } catch (error) {
        console.error("Failed to check answer:", error);
        if (feedback) {
            feedback.textContent = "Unable to check this answer right now.";
        }
    }
}

document.addEventListener("DOMContentLoaded", loadProblemSetDetail);
