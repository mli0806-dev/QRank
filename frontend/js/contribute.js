import { escapeHtml, renderMarkdown, renderMathIn } from './core/dom.js';
import { getCurrentUser } from './core/auth-state.js';
import { initMarkdownToolbar } from './core/markdown-toolbar.js';
import { initDesmosTool, desmosToolEnabled } from './desmos.js';
import { renderChoiceInputs } from './problem-sets/choice-render.js';

async function initSuggestionFormSelects(preselect = null) {
    const courseSelect = document.getElementById("suggest-course");
    const topicSelect = document.getElementById("suggest-topic");
    const subtopicSelect = document.getElementById("suggest-subtopic");
    const tagsSelect = document.getElementById("suggest-tags");

    if (!courseSelect || !topicSelect || !subtopicSelect || !tagsSelect) {
        return;
    }

    let courses = [];

    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        courses = await response.json();
    } catch (error) {
        console.error('Failed to load courses for suggestion form:', error);
    }

    const populateSubtopics = (courseName, topicName, selectSubtopicName) => {
        const selectedCourse = courses.find((course) => course.course === courseName);
        const selectedTopic = selectedCourse?.topics.find((topic) => topic.name === topicName);
        const subtopics = selectedTopic ? (selectedTopic.subtopics || []) : [];

        subtopicSelect.innerHTML = '<option value="">No specific subtopic</option>' +
            subtopics.map((subtopic) => `<option value="${escapeHtml(subtopic.name)}">${escapeHtml(subtopic.name)}</option>`).join('');

        subtopicSelect.value = selectSubtopicName || "";
    };

    const populateTopics = (courseName, selectTopicName, selectSubtopicName) => {
        const selectedCourse = courses.find((course) => course.course === courseName);
        const topics = selectedCourse ? selectedCourse.topics : [];

        topicSelect.innerHTML = topics.length
            ? topics.map((topic) => `<option value="${escapeHtml(topic.name)}">${escapeHtml(topic.name)}</option>`).join('')
            : '<option value="" disabled selected>No topics available</option>';

        if (selectTopicName) {
            topicSelect.value = selectTopicName;
        }

        populateSubtopics(courseName, topicSelect.value, selectSubtopicName);
    };

    courseSelect.innerHTML = courses.length
        ? '<option value="" disabled selected>Select a course</option>' +
            courses.map((course) => `<option value="${escapeHtml(course.course)}">${escapeHtml(course.course)}</option>`).join('')
        : '<option value="" disabled selected>No courses available</option>';

    courseSelect.addEventListener("change", () => populateTopics(courseSelect.value));
    topicSelect.addEventListener("change", () => populateSubtopics(courseSelect.value, topicSelect.value));

    try {
        const response = await fetch('/api/tags');
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const { tags } = await response.json();
        tagsSelect.innerHTML = (tags || []).map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
    } catch (error) {
        console.error('Failed to load tags for suggestion form:', error);
    }

    if (preselect) {
        if (preselect.course) {
            courseSelect.value = preselect.course;
            populateTopics(preselect.course, preselect.topic, preselect.subtopic);
        }

        if (Array.isArray(preselect.tags)) {
            Array.from(tagsSelect.options).forEach((option) => {
                option.selected = preselect.tags.includes(option.value);
            });
        }
    }
}


let editingSuggestionId = null;

async function submitProblemSetSuggestion(event) {
    if (event) {
        event.preventDefault();
    }

    const statusElement = document.getElementById("suggestion-status");
    const form = document.getElementById("suggest-problem-set-form");
    if (!form || !statusElement) {
        return;
    }

    statusElement.textContent = editingSuggestionId ? "Saving changes..." : "Submitting suggestion...";

    const problems = serializeProblemItems();
    if (!problems.length) {
        statusElement.textContent = "Please add at least one problem.";
        return;
    }

    const tagsSelect = document.getElementById("suggest-tags");
    const nameInput = document.getElementById("suggest-name");
    const courseInput = document.getElementById("suggest-course");
    const topicInput = document.getElementById("suggest-topic");
    const subtopicInput = document.getElementById("suggest-subtopic");
    const descriptionInput = document.getElementById("suggest-description");
    const calculatorAllowedInput = document.getElementById("suggest-calculator-allowed");

    if (!tagsSelect || !nameInput || !courseInput || !topicInput || !subtopicInput || !descriptionInput || !calculatorAllowedInput) {
        statusElement.textContent = "This form is missing required fields. Please reload the page.";
        return;
    }

    const selectedTags = Array.from(tagsSelect.selectedOptions).map((option) => option.value);

    const payload = {
        name: nameInput.value.trim(),
        course: courseInput.value.trim(),
        topic: topicInput.value.trim(),
        subtopic: subtopicInput.value.trim(),
        tags: selectedTags.join(','),
        description: descriptionInput.value.trim(),
        problems: JSON.stringify(problems),
        calculatorAllowed: calculatorAllowedInput.checked,
        assessmentEnabled: document.getElementById("suggest-assessment-enabled")?.checked || false,
        submitter: null
    };

    const currentUser = await getCurrentUser();
    if (currentUser) {
        payload.submitter = currentUser.username || null;
    }

    if (!payload.name || !payload.course || !payload.topic || !problems.length) {
        statusElement.textContent = "Please complete all required fields.";
        return;
    }

    try {
        const response = editingSuggestionId
            ? await fetch(`/api/admin/problem-set-suggestions/${encodeURIComponent(editingSuggestionId)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            })
            : await fetch("/api/problem-set-suggestions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
        const data = await response.json();

        if (!response.ok) {
            statusElement.textContent = data.message || "Unable to save.";
            return;
        }

        if (editingSuggestionId) {
            statusElement.textContent = "Publishing changes...";

            const approveResponse = await fetch(`/api/admin/problem-set-suggestions/${encodeURIComponent(editingSuggestionId)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "approved" })
            });
            const approveData = await approveResponse.json();

            if (!approveResponse.ok) {
                statusElement.textContent = approveData.message || "Changes saved, but publishing failed.";
                return;
            }

            window.location.href = `/problems/${encodeURIComponent(approveData.createdProblemSetId)}`;
            return;
        }

        statusElement.textContent = data.message || "Suggestion received. Thank you!";
        form.reset();
    } catch (error) {
        console.error("Failed to submit suggestion:", error);
        statusElement.textContent = "Unable to save right now.";
    }
}


async function initContributePage() {
    const currentUser = await getCurrentUser();
    const subtext = document.getElementById("contribute-page-subtext");

    if (!currentUser) {
        const fields = document.getElementById("suggest-fields");
        const right = document.querySelector(".problemsetdetailright");
        if (subtext) {
            subtext.textContent = "You need to be logged in to contribute a problem set.";
        }
        if (fields) {
            fields.innerHTML = `<p class="topicdetailtext">Please <a class="footerlink" href="/login/">log in</a> to submit a problem set.</p>`;
        }
        if (right) {
            right.classList.add("hidden");
        }
        return;
    }

    const suggestForm = document.getElementById("suggest-problem-set-form");
    const addProblemButton = document.getElementById("add-problem-button");

    if (suggestForm) {
        suggestForm.addEventListener("submit", submitProblemSetSuggestion);
    }

    if (addProblemButton) {
        addProblemButton.addEventListener("click", addProblemItem);
    }

    initMarkdownToolbar(".markdownbutton[data-markdown]", document.getElementById("suggest-description"));
    initDesmosTool();
    initAssessmentToggle();

    if (currentUser.role === "admin") {
        const assessmentField = document.getElementById("suggest-assessment-field");
        if (assessmentField) {
            assessmentField.classList.remove("hidden");
        }
    }

    const editId = new URLSearchParams(window.location.search).get("editSuggestion");
    const statusElement = document.getElementById("suggestion-status");

    if (!editId) {
        await initSuggestionFormSelects();
        addProblemItem();
        return;
    }

    if (statusElement) {
        statusElement.textContent = "Loading problem set for editing...";
    }

    try {
        const response = await fetch(`/api/admin/problem-set-suggestions/${encodeURIComponent(editId)}`);

        if (!response.ok) {
            if (statusElement) {
                statusElement.textContent = "Unable to load this problem set for editing.";
            }
            await initSuggestionFormSelects();
            addProblemItem();
            return;
        }

        const { suggestion } = await response.json();
        editingSuggestionId = suggestion.id;

        document.getElementById("suggest-name").value = suggestion.name || "";
        document.getElementById("suggest-description").value = suggestion.description || "";
        document.getElementById("suggest-calculator-allowed").checked = Boolean(suggestion.calculatorAllowed);

        const assessmentCheckbox = document.getElementById("suggest-assessment-enabled");
        if (assessmentCheckbox) {
            assessmentCheckbox.checked = Boolean(suggestion.assessmentEnabled);
        }
        setAssessmentEnabled(Boolean(suggestion.assessmentEnabled));

        await initSuggestionFormSelects({ course: suggestion.course, topic: suggestion.topic, subtopic: suggestion.subtopic, tags: suggestion.tags });

        if (suggestion.problems.length) {
            suggestion.problems.forEach((problem) => populateProblemItem(addProblemItem(), problem));
        } else {
            addProblemItem();
        }

        const submitButton = suggestForm?.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.textContent = "Save Changes";
        }

        const heading = document.getElementById("contribute-page-heading");
        if (heading) {
            heading.textContent = `Editing: ${suggestion.name}`;
        }

        if (subtext) {
            subtext.textContent = "Saving will publish these changes immediately.";
        }

        if (statusElement) {
            statusElement.textContent = "";
        }
    } catch (error) {
        console.error("Failed to load problem set for editing:", error);
        if (statusElement) {
            statusElement.textContent = "Unable to load this problem set for editing.";
        }
        await initSuggestionFormSelects();
        addProblemItem();
    }
}


function extractProblemItemData(item) {
    const prompt = item.querySelector('.problem-prompt').value.trim();
    const type = item.querySelector('.problem-type').value;
    const pointsInput = item.querySelector('.problem-points');
    const points = pointsInput ? Math.max(0, Math.trunc(Number(pointsInput.value) || 0)) : 0;
    const explanationInput = item.querySelector('.problem-explanation');
    const explanation = explanationInput ? explanationInput.value.trim() : '';

    if (type === 'multiple_choice') {
        const choiceRows = Array.from(item.querySelectorAll('.problemtakechoice'));
        const choices = choiceRows.map(row => row.querySelector('.choice-input').value.trim()).filter(Boolean);
        const checkedRadio = item.querySelector('.problemtakechoiceinput:checked');
        const checkedRow = checkedRadio ? checkedRadio.closest('.problemtakechoice') : null;
        const answer = checkedRow ? checkedRow.querySelector('.choice-input').value.trim() : '';

        return { prompt, type, choices, answer, points, explanation };
    }

    const answer = item.querySelector('.problem-answer').value.trim();
    return { prompt, type, choices: [], answer, points, explanation };
}

function serializeProblemItems() {
    const items = Array.from(document.querySelectorAll('.problemtakeitem'));
    return items.map(extractProblemItemData)
        .filter(problem => problem.prompt && problem.type && problem.answer && (problem.type !== 'multiple_choice' || problem.choices.length > 0));
}

function getProblemBuilderItems() {
    const container = document.getElementById('problem-items');
    return container ? Array.from(container.children) : [];
}

function showProblemBuilderItem(index) {
    getProblemBuilderItems().forEach((item, itemIndex) => {
        item.classList.toggle('hidden', itemIndex !== index);
    });

    document.querySelectorAll('#problem-builder-toc .problemtocitem').forEach((button) => {
        button.classList.toggle('problemtocitemactive', Number(button.dataset.problemIndex) === index);
    });
}

function refreshProblemBuilderToc() {
    const toc = document.getElementById('problem-builder-toc');
    if (!toc) {
        return;
    }

    toc.innerHTML = getProblemBuilderItems().map((_, index) => `
        <button type="button" class="problemtocitem" data-problem-index="${index}">${index + 1}</button>
    `).join('');

    toc.querySelectorAll('.problemtocitem').forEach((button) => {
        button.addEventListener('click', () => {
            showProblemBuilderItem(Number(button.dataset.problemIndex));
        });
    });
}

function refreshProblemBuilderNav() {
    const items = getProblemBuilderItems();
    items.forEach((item, index) => {
        const nav = item.querySelector('.problemtakenav');
        const prevButton = item.querySelector('[data-nav="prev"]');
        const nextButton = item.querySelector('[data-nav="next"]');
        const prevHidden = index === 0;
        const nextHidden = index === items.length - 1;

        if (prevButton) {
            prevButton.classList.toggle('hidden', prevHidden);
        }
        if (nextButton) {
            nextButton.classList.toggle('hidden', nextHidden);
        }
        if (nav) {
            nav.classList.toggle('hidden', prevHidden && nextHidden);
        }
    });
}

function refreshProblemBuilder(activeIndex) {
    refreshProblemBuilderToc();
    refreshProblemBuilderNav();
    showProblemBuilderItem(activeIndex);
}

function removeProblemItem(button) {
    const item = button.closest('.problemtakeitem');
    if (!item) {
        return;
    }

    const items = getProblemBuilderItems();
    const removedIndex = items.indexOf(item);
    item.remove();

    const remainingCount = getProblemBuilderItems().length;
    refreshProblemBuilder(Math.max(Math.min(removedIndex, remainingCount - 1), 0));
}

const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MIN_CHOICES = 2;
const MAX_CHOICES = CHOICE_LETTERS.length;
let problemItemCounter = 0;

function renumberChoices(item) {
    const rows = Array.from(item.querySelectorAll('.problemtakechoice'));
    rows.forEach((row, index) => {
        const letter = CHOICE_LETTERS[index];
        const letterLabel = row.querySelector('.choice-letter-label');
        const input = row.querySelector('.choice-input');

        if (letterLabel) {
            letterLabel.textContent = letter;
        }
        if (input) {
            input.placeholder = `Choice ${letter}`;
        }
    });
}

function createChoiceRow(groupName) {
    const row = document.createElement('div');
    row.className = 'problemtakechoice';
    row.innerHTML = `
        <label class="problemtakechoiceletter">
            <input type="radio" name="${groupName}" class="problemtakechoiceinput" title="Mark as the correct answer" required>
            <span class="choice-letter-label"></span>
        </label>
        <input class="inputs choice-input" type="text" placeholder="Choice" required>
    `;
    return row;
}

function addChoiceRow(item) {
    const choiceList = item.querySelector('.problem-choice-list');
    if (!choiceList) {
        return;
    }

    const rows = choiceList.querySelectorAll('.problemtakechoice');
    if (rows.length >= MAX_CHOICES) {
        return;
    }

    choiceList.appendChild(createChoiceRow(choiceList.dataset.groupName));
    renumberChoices(item);
}

function removeChoiceRow(item) {
    const choiceList = item.querySelector('.problem-choice-list');
    if (!choiceList) {
        return;
    }

    const rows = choiceList.querySelectorAll('.problemtakechoice');
    if (rows.length <= MIN_CHOICES) {
        return;
    }

    rows[rows.length - 1].remove();
    renumberChoices(item);
}


function updateProblemItemTypeFields(item) {
    const type = item.querySelector('.problem-type').value;
    const choiceLabel = item.querySelector('.problem-choice-label');
    const choiceList = item.querySelector('.problem-choice-list');
    const choiceButtons = item.querySelector('.choice-buttons');
    const answerLabel = item.querySelector('.problem-answer-label');
    const answerInput = item.querySelector('.problem-answer');
    const correctRadios = Array.from(item.querySelectorAll('.problemtakechoiceinput'));
    const choiceInputs = Array.from(item.querySelectorAll('.choice-input'));

    if (type === 'free_response') {
        if (choiceLabel) {
            choiceLabel.style.display = 'none';
        }
        if (choiceList) {
            choiceList.style.display = 'none';
        }
        if (choiceButtons) {
            choiceButtons.style.display = 'none';
        }
        correctRadios.forEach(radio => {
            radio.required = false;
        });
        choiceInputs.forEach(input => {
            input.required = false;
        });
        if (answerLabel) {
            answerLabel.style.display = '';
            answerLabel.textContent = 'Acceptable Answers';
        }
        if (answerInput) {
            answerInput.style.display = '';
            answerInput.required = true;
            answerInput.placeholder = 'Enter acceptable answers separated by commas:';
        }
    } else {
        if (choiceLabel) {
            choiceLabel.style.display = '';
            choiceLabel.textContent = 'Answer Choices (select the correct one)';
        }
        if (choiceList) {
            choiceList.style.display = '';
        }
        if (choiceButtons) {
            choiceButtons.style.display = '';
        }
        correctRadios.forEach(radio => {
            radio.required = true;
        });
        choiceInputs.forEach(input => {
            input.required = true;
        });
        if (answerLabel) {
            answerLabel.style.display = 'none';
        }
        if (answerInput) {
            answerInput.style.display = 'none';
            answerInput.required = false;
        }
    }
}

let assessmentEnabled = false;

function setAssessmentEnabled(enabled) {
    assessmentEnabled = enabled;
    document.querySelectorAll(".problem-points-field").forEach((field) => field.classList.toggle("hidden", !enabled));
}

function initAssessmentToggle() {
    const checkbox = document.getElementById("suggest-assessment-enabled");
    if (!checkbox) {
        return;
    }

    checkbox.addEventListener("change", () => setAssessmentEnabled(checkbox.checked));
}

function buildProblemPreviewHtml(problem) {
    const inputHtml = problem.type === 'multiple_choice'
        ? renderChoiceInputs(problem, { markCorrect: true })
        : `<input type="text" class="inputs" placeholder="Your answer" disabled>`;

    return `
        <div class="problemtakeitem">
            <div class="problemtakeprompt"><span class="problemtakenumber">1.</span> ${renderMarkdown(problem.prompt, "No prompt entered yet.")}</div>
            <div class="problemtakeinput">${inputHtml}</div>
        </div>
    `;
}

function closeProblemPreview() {
    const existing = document.querySelector(".problempreviewoverlay");
    if (existing) {
        existing.remove();
    }
}

function openProblemPreview(item) {
    closeProblemPreview();

    const problem = extractProblemItemData(item);

    const overlay = document.createElement('div');
    overlay.className = 'problempreviewoverlay';
    overlay.innerHTML = `
        <div class="problempreviewmodal">
            <div class="problempreviewheader">
                <span class="aboutustitle">Preview</span>
                <button type="button" class="problempreviewclose" aria-label="Close">&times;</button>
            </div>
            <div class="problempreviewcontent">${buildProblemPreviewHtml(problem)}</div>
        </div>
    `;
    document.body.appendChild(overlay);
    renderMathIn(overlay);

    overlay.querySelector('.problempreviewclose').addEventListener('click', closeProblemPreview);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
            closeProblemPreview();
        }
    });
}


function addProblemItem() {
    const container = document.getElementById('problem-items');
    if (!container) {
        return;
    }

    const problemIndex = container.children.length + 1;
    problemItemCounter += 1;
    const groupName = `correct-choice-${problemItemCounter}`;

    const template = document.createElement('div');
    template.className = 'problem-item problemtakeitem';
    template.innerHTML = `
        <div class="problem-item-header">
            <span class="aboutustitle">Problem ${problemIndex}</span>
            <div class="problem-item-header-actions">
                <button type="button" class="authsubmit preview-problem-button">Preview</button>
                <button type="button" class="authsubmit remove-problem-button">Remove</button>
            </div>
        </div>
        <label class="aboutustitle">Problem Type</label>
        <select class="inputs problem-type">
            <option value="multiple_choice">Multiple Choice</option>
            <option value="free_response">Free Response</option>
        </select>
        <label class="aboutustitle">Prompt</label>
        <textarea class="inputs problem-prompt" rows="4" placeholder="Enter here:" required></textarea>
        <button class="markdownbutton desmostoolbutton${desmosToolEnabled ? '' : ' hidden'}" type="button">Insert Desmos graph</button>
        <label class="aboutustitle problem-choice-label">Answer Choices (select the correct one)</label>
        <div class="problem-choice-list" data-group-name="${groupName}"></div>
        <div class="choice-buttons">
            <button type="button" class="authsubmit add-choice-button">Add answer choice</button>
            <button type="button" class="authsubmit subtract-choice-button">Subtract answer choice</button>
        </div>
        <label class="aboutustitle problem-answer-label">Acceptable Answers</label>
        <input class="inputs problem-answer" type="text" placeholder="Enter acceptable answers separated by commas:">
        <label class="aboutustitle">Explanation (optional)</label>
        <textarea class="inputs problem-explanation" rows="3" placeholder="Shown to students after they check their answer"></textarea>
        <div class="problem-points-field${assessmentEnabled ? '' : ' hidden'}">
            <label class="aboutustitle">Points</label>
            <input class="inputs problem-points" type="number" min="0" step="1" placeholder="0" value="0">
        </div>
        <div class="problemtakenav">
            <button type="button" class="topicdetailback" data-nav="prev">Previous problem</button>
            <button type="button" class="topicdetailback" data-nav="next">Next problem</button>
        </div>
    `;

    container.appendChild(template);

    const choiceList = template.querySelector('.problem-choice-list');
    for (let i = 0; i < 4; i += 1) {
        choiceList.appendChild(createChoiceRow(groupName));
    }
    renumberChoices(template);

    const removeButton = template.querySelector('.remove-problem-button');
    removeButton.addEventListener('click', () => removeProblemItem(removeButton));

    const previewButton = template.querySelector('.preview-problem-button');
    if (previewButton) {
        previewButton.addEventListener('click', () => openProblemPreview(template));
    }

    const addChoiceButton = template.querySelector('.add-choice-button');
    if (addChoiceButton) {
        addChoiceButton.addEventListener('click', () => addChoiceRow(template));
    }

    const subtractChoiceButton = template.querySelector('.subtract-choice-button');
    if (subtractChoiceButton) {
        subtractChoiceButton.addEventListener('click', () => removeChoiceRow(template));
    }

    const typeSelect = template.querySelector('.problem-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', () => updateProblemItemTypeFields(template));
    }

    const prevButton = template.querySelector('[data-nav="prev"]');
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            const index = getProblemBuilderItems().indexOf(template);
            if (index > 0) {
                showProblemBuilderItem(index - 1);
            }
        });
    }

    const nextButton = template.querySelector('[data-nav="next"]');
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            const items = getProblemBuilderItems();
            const index = items.indexOf(template);
            if (index >= 0 && index < items.length - 1) {
                showProblemBuilderItem(index + 1);
            }
        });
    }

    updateProblemItemTypeFields(template);
    refreshProblemBuilder(getProblemBuilderItems().indexOf(template));
    return template;
}

function populateProblemItem(template, problem) {
    if (!template || !problem) {
        return;
    }

    const typeSelect = template.querySelector('.problem-type');
    if (typeSelect) {
        typeSelect.value = problem.type === 'multiple_choice' ? 'multiple_choice' : 'free_response';
    }

    const promptInput = template.querySelector('.problem-prompt');
    if (promptInput) {
        promptInput.value = problem.prompt || '';
    }

    const pointsInput = template.querySelector('.problem-points');
    if (pointsInput) {
        pointsInput.value = Number.isFinite(Number(problem.points)) ? Number(problem.points) : 0;
    }

    const explanationInput = template.querySelector('.problem-explanation');
    if (explanationInput) {
        explanationInput.value = problem.explanation || '';
    }

    if (problem.type === 'multiple_choice') {
        const choices = Array.isArray(problem.choices) ? problem.choices : [];

        while (template.querySelectorAll('.problemtakechoice').length < choices.length) {
            addChoiceRow(template);
        }
        while (template.querySelectorAll('.problemtakechoice').length > choices.length && template.querySelectorAll('.problemtakechoice').length > MIN_CHOICES) {
            removeChoiceRow(template);
        }

        const rows = Array.from(template.querySelectorAll('.problemtakechoice'));
        rows.forEach((row, index) => {
            const input = row.querySelector('.choice-input');
            const radio = row.querySelector('.problemtakechoiceinput');
            const choiceText = choices[index] || '';

            if (input) {
                input.value = choiceText;
            }
            if (radio && choiceText && choiceText === problem.answer) {
                radio.checked = true;
            }
        });
    } else {
        const answerInput = template.querySelector('.problem-answer');
        if (answerInput) {
            answerInput.value = problem.answer || '';
        }
    }

    updateProblemItemTypeFields(template);
}

export { initContributePage, addProblemItem, serializeProblemItems };
