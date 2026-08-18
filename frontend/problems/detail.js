async function loadProblemSetDetail() {
    const container = document.getElementById("problemsetdetailcontainer");

    if (!container) {
        return;
    }

    const parts = window.location.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    const problemSetId = parts[1];

    if (!problemSetId) {
        container.innerHTML = `
            <a class="topicdetailback" href="/problems/">Back to Problem Sets</a>
            <h1 class="topicdetailtitle">Problem set not found</h1>
            <p class="topicdetailtext">No problem set ID was provided.</p>
        `;
        return;
    }

    try {
        const response = await fetch(`/api/problem-sets/${encodeURIComponent(problemSetId)}`);

        if (!response.ok) {
            container.innerHTML = `
                <a class="topicdetailback" href="/problems/">Back to Problem Sets</a>
                <h1 class="topicdetailtitle">Problem set not found</h1>
                <p class="topicdetailtext">We couldn't find that problem set.</p>
            `;
            return;
        }

        const { problemSet, problems } = await response.json();
        renderProblemSetDetail(container, problemSetId, problemSet, problems);
    } catch (error) {
        console.error("Failed to load problem set:", error);
        container.innerHTML = `
            <a class="topicdetailback" href="/problems/">Back to Problem Sets</a>
            <h1 class="topicdetailtitle">Problem set unavailable</h1>
            <p class="topicdetailtext">Unable to load this problem set right now.</p>
        `;
    }
}

function renderProblemSetDetail(container, problemSetId, problemSet, problems) {
    const problemsHtml = problems.length
        ? problems.map((problem, index) => renderProblem(problem, index)).join('')
        : '<p class="topicdetailtext">This problem set has no problems yet.</p>';

    container.innerHTML = `
        <a class="topicdetailback" href="/problems/">Back to Problem Sets</a>
        <h1 class="topicdetailtitle">${escapeHtml(problemSet.name)}</h1>
        <p class="topicdetailtext">${escapeHtml(problemSet.description || "No description available yet.")}</p>
        ${problemsHtml}
    `;

    problems.forEach((problem) => {
        const form = document.getElementById(`problemtakeform-${problem.id}`);
        if (form) {
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                checkSingleProblem(problemSetId, problem);
            });
        }
    });
}

function renderProblem(problem, index) {
    const number = index + 1;
    const choices = Array.isArray(problem.choices) ? problem.choices : [];

    const inputHtml = problem.type === "multiple_choice"
        ? choices.map((choice) => `
            <label class="problemtakechoice">
                <input type="radio" name="problem-${problem.id}" value="${escapeHtml(choice)}">
                <span>${escapeHtml(choice)}</span>
            </label>
        `).join('')
        : `<input type="text" class="inputs" id="problem-input-${problem.id}" name="problem-${problem.id}" placeholder="Your answer" autocomplete="off">`;

    return `
        <form class="problemtakeitem" id="problemtakeform-${problem.id}">
            <p class="problemtakeprompt">${number}. ${escapeHtml(problem.prompt)}</p>
            <div class="problemtakeinput">${inputHtml}</div>
            <button type="submit" class="authsubmit">Check</button>
            <p class="problemtakefeedback"></p>
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

        const { results } = await response.json();
        const isCorrect = Boolean(results[problem.id]);

        if (feedback) {
            feedback.textContent = isCorrect ? "Correct" : "Incorrect";
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
