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
        initStartOverButton(problemSetId);
        initCountdownTimer(problemSet.timeLimitMinutes);
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

let countdownIntervalId = null;

function formatCountdown(totalSeconds) {
    const clamped = Math.max(0, totalSeconds);
    const minutes = Math.floor(clamped / 60);
    const seconds = clamped % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function initCountdownTimer(timeLimitMinutes) {
    const timerEl = document.getElementById("problem-set-timer");
    const valueEl = document.getElementById("problem-set-timer-value");

    if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
    }

    if (!timerEl || !valueEl) {
        return;
    }

    if (!timeLimitMinutes) {
        timerEl.classList.add("hidden");
        return;
    }

    let remainingSeconds = timeLimitMinutes * 60;
    timerEl.classList.remove("hidden");
    valueEl.textContent = formatCountdown(remainingSeconds);

    countdownIntervalId = setInterval(() => {
        remainingSeconds -= 1;

        if (remainingSeconds <= 0) {
            valueEl.textContent = "Time's up";
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
            return;
        }

        valueEl.textContent = formatCountdown(remainingSeconds);
    }, 1000);
}

function renderProblemSetDetail(container, problemSetId, problemSet, problems, targetProblemId) {
    const tocHtml = problems.length
        ? `
            <div class="problemtoc">
                ${problems.map((problem, index) => `
                    <button type="button" class="problemtocitem" data-problem-index="${index}" data-problem-id="${problem.id}">${index + 1}</button>
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
            <button type="button" id="start-over-button" class="topicdetailback hidden">Start Over</button>
            <div class="topicdetailtext">${renderMarkdown(problemSet.description, "No description available yet.")}</div>
            ${problemSet.calculatorAllowed ? '<p class="tag">Calculator approved</p>' : ''}
            ${problemSet.isPublic === false ? '<p class="tag">Private (only visible to you)</p>' : ''}
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
            restorePriorAttempt(problem);
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

async function initStartOverButton(problemSetId) {
    const button = document.getElementById("start-over-button");
    if (!button) {
        return;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        return;
    }

    button.classList.remove("hidden");
    button.addEventListener("click", async () => {
        if (!window.confirm("Reset your progress on this problem set? This can't be undone.")) {
            return;
        }

        button.disabled = true;
        button.textContent = "Resetting...";

        try {
            const response = await fetch(`/api/problem-sets/${encodeURIComponent(problemSetId)}/reset`, {
                method: "POST"
            });

            if (!response.ok) {
                button.disabled = false;
                button.textContent = "Start Over";
                return;
            }

            window.location.reload();
        } catch (error) {
            console.error("Failed to reset problem set progress:", error);
            button.disabled = false;
            button.textContent = "Start Over";
        }
    });
}

function updateProblemTocStatus(problemId, isCorrect) {
    const button = document.querySelector(`.problemtocitem[data-problem-id="${problemId}"]`);
    if (!button) {
        return;
    }

    button.classList.remove("problemtocitemcorrect", "problemtocitemincorrect");

    if (isCorrect === true) {
        button.classList.add("problemtocitemcorrect");
    } else if (isCorrect === false) {
        button.classList.add("problemtocitemincorrect");
    }
}

function renderProblem(problem, index, total) {
    const number = index + 1;

    const inputHtml = problem.type === "multiple_choice"
        ? renderChoiceInputs(problem, { interactive: true, namePrefix: `problem-${problem.id}`, selectedValue: problem.priorAnswer })
        : `<input type="text" class="inputs" id="problem-input-${problem.id}" name="problem-${problem.id}" placeholder="Your answer" autocomplete="off" value="${escapeHtml(problem.priorAnswer || "")}">`;

    const explainButtonHtml = problem.hasExplanation
        ? '<button type="button" class="topicdetailback problemtakeexplainbutton" disabled>Explain</button>'
        : "";

    return `
        <form class="problemtakeitem" id="problemtakeform-${problem.id}">
            <div class="problemtakescroll">
                <div class="problemtakeprompt"><span class="problemtakenumber">${number}.</span> <span class="problemtakeid">#${escapeHtml(problem.id)}</span> ${renderMarkdown(problem.prompt, "")}</div>
                <div class="problemtakeinput">${inputHtml}</div>
                <p class="problemtakefeedback"></p>
                ${problem.hasExplanation ? '<p class="problemtakeexplanation hidden"></p>' : ""}
            </div>
            <div class="problemtakecontrols">
                <button type="submit" class="authsubmit" disabled>Check</button>
                <div class="problemtakenav">
                    ${index === 0 ? "" : '<button type="button" class="topicdetailback" data-nav="prev">Previous problem</button>'}
                    <div class="problemtakenavright">
                        ${explainButtonHtml}
                        ${index === total - 1 ? "" : '<button type="button" class="topicdetailback" data-nav="next">Next problem</button>'}
                    </div>
                </div>
            </div>
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

function applyProblemResult(item, problem, { isCorrect, correctAnswer, explanationText }) {
    const explainButton = item.querySelector(".problemtakeexplainbutton");
    const explanationEl = item.querySelector(".problemtakeexplanation");

    if (explainButton && explanationEl && typeof explanationText === "string" && explanationText.trim() !== "") {
        explainButton.disabled = false;
        explanationEl.innerHTML = renderMarkdown(explanationText, "");
        renderMathIn(explanationEl);
    }

    if (problem.type === "multiple_choice") {
        const normalizedCorrect = typeof correctAnswer === "string"
            ? correctAnswer.trim().toLowerCase()
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
        const answerInput = item.querySelector(`#problem-input-${problem.id}`);
        if (answerInput) {
            answerInput.classList.toggle("problemtakeanswercorrect", isCorrect);
            answerInput.classList.toggle("problemtakeanswerincorrect", !isCorrect);
        }
    }
}

function restorePriorAttempt(problem) {
    if (problem.priorAnswer === null || problem.priorAnswer === undefined) {
        return;
    }

    const item = document.getElementById(`problemtakeform-${problem.id}`);
    if (!item) {
        return;
    }

    const feedback = item.querySelector(".problemtakefeedback");
    if (feedback) {
        feedback.textContent = problem.priorIsCorrect ? "Correct" : "Incorrect";
    }

    applyProblemResult(item, problem, {
        isCorrect: problem.priorIsCorrect,
        correctAnswer: problem.priorCorrectAnswer,
        explanationText: problem.priorExplanation
    });

    updateProblemTocStatus(problem.id, problem.priorIsCorrect);
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

        if (feedback) {
            feedback.textContent = isCorrect && pointsAwarded
                ? `Correct (+${pointsAwarded} QScore)`
                : (isCorrect ? "Correct" : "Incorrect");
        }

        if (item) {
            applyProblemResult(item, problem, {
                isCorrect,
                correctAnswer: correctAnswers ? correctAnswers[problem.id] : undefined,
                explanationText: explanations ? explanations[problem.id] : undefined
            });
        }

        updateProblemTocStatus(problem.id, isCorrect);
    } catch (error) {
        console.error("Failed to check answer:", error);
        if (feedback) {
            feedback.textContent = "Unable to check this answer right now.";
        }
    }
}

document.addEventListener("DOMContentLoaded", loadProblemSetDetail);
