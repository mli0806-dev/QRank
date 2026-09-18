import { escapeHtml, slugify } from '../core/dom.js';
import { renderProblemSetCard } from '../problem-sets/search.js';

function toggleDropdown(button) {
    const dropdown = button.parentElement.nextElementSibling

    const isopen = dropdown.classList.toggle("show");
    button.classList.toggle("open", isopen);
}


function getTopicRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get("topic");
    const subtopicParam = params.get("subtopic");

    if (parts[0] === "topics") {
        if (parts.length >= 4) {
            return {
                view: "unit",
                topicSlug: parts[1],
                subtopicSlug: parts[2],
                unitSlug: parts[3]
            };
        }

        if (parts.length >= 3) {
            return {
                view: "subtopic",
                topicSlug: parts[1],
                subtopicSlug: parts[2]
            };
        }

        if (parts.length >= 2) {
            return {
                view: "topic",
                topicSlug: parts[1]
            };
        }

        return { view: "index" };
    }

    if (topicParam && subtopicParam) {
        return {
            view: "subtopic",
            topicSlug: topicParam,
            subtopicSlug: subtopicParam
        };
    }

    if (topicParam) {
        return {
            view: "topic",
            topicSlug: topicParam
        };
    }

    return { view: "index" };
}

function renderTopicIndex(topics) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    container.innerHTML = topics.map(topic => {
        const subtopicshtml = topic.subtopics.map(subtopic => {
            const tagarray = subtopic.tags ? subtopic.tags.split(', ') : [];
            const tagshtml = renderParenTags(tagarray);

            return `
                <a href="/topics/${encodeURIComponent(slugify(topic.topic))}/${encodeURIComponent(slugify(subtopic.name))}">
                    ${escapeHtml(subtopic.name)} ${tagshtml}
                </a>
            `;
        }).join(' ');

        return `
            <div class="topicboxes">
                <div class="topicheader">
                    <h3 class="topictitle">
                        <a class="topictitlelink" href="/topics/${encodeURIComponent(slugify(topic.topic))}">
                            ${escapeHtml(topic.topic)}
                        </a>
                    </h3>
                    <button class="dropdownbutton">⌄</button>
                </div>
                <div class="dropdowncontent">
                    ${subtopicshtml || '<a href="#">No subtopics available</a>'}
                </div>
            </div>
        `;
    }).join(' ');

    container.querySelectorAll(".dropdownbutton").forEach((button) => {
        button.addEventListener("click", () => toggleDropdown(button));
    });
}

function renderTopicDetail(topics, topicSlug) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    const selectedTopic = topics.find(topic => slugify(topic.topic) === topicSlug);

    if (!selectedTopic) {
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Topic not found</h1>
                <p class="topicdetailtext">We couldn't find that topic. Go back to the <a href="/topics/">topic gallery</a> and try another one.</p>
            </div>
        `;
        return;
    }

    const subtopicshtml = selectedTopic.subtopics.length
        ? selectedTopic.subtopics.map(subtopic => {
            const tagarray = subtopic.tags ? subtopic.tags.split(', ') : [];
            const tagshtml = renderParenTags(tagarray);

            return `
                <a class="topicdetailitem" id="${slugify(subtopic.name)}" href="/topics/${encodeURIComponent(topicSlug)}/${encodeURIComponent(slugify(subtopic.name))}">
                    <span class="topicdetailitemtitle">${escapeHtml(subtopic.name)}</span>
                    <span class="topicdetailitemmeta">${tagshtml}</span>
                </a>
            `;
        }).join('')
        : '<p class="topicdetailtext">No subtopics available yet.</p>';

    container.innerHTML = `
        <div class="topicdetail topicdetail-${escapeHtml(topicSlug)}">
            <a class="topicdetailback" href="/topics/">Back to all topics</a>
            <h1 class="topicdetailtitle">${escapeHtml(selectedTopic.topic)}</h1>
            <div class="topicdetailgrid">
                ${subtopicshtml}
            </div>
        </div>
    `;
}

function renderParenTags(tagarray) {
    return tagarray.map(tag => `<span class="tag">(${escapeHtml(tag)})</span>`).join(' ');
}


async function renderSubtopicDetail(topics, topicSlug, subtopicSlug) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    const selectedTopic = topics.find(topic => slugify(topic.topic) === topicSlug);

    if (!selectedTopic) {
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Topic not found</h1>
                <p class="topicdetailtext">We couldn't find that topic. Go back to the <a href="/topics/">topic gallery</a> and try another one.</p>
            </div>
        `;
        return;
    }

    const selectedSubtopic = selectedTopic.subtopics.find(subtopic => slugify(subtopic.name) === subtopicSlug);

    if (!selectedSubtopic) {
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/topics/${encodeURIComponent(topicSlug)}">Back to ${escapeHtml(selectedTopic.topic)}</a>
                <h1 class="topicdetailtitle">Subtopic not found</h1>
                <p class="topicdetailtext">We couldn't find that subtopic inside this topic.</p>
            </div>
        `;
        return;
    }

    const tagarray = selectedSubtopic.tags ? selectedSubtopic.tags.split(', ') : [];
    const tagshtml = renderParenTags(tagarray);

    const units = selectedSubtopic.units || [];
    const unitsHtml = units.length
        ? `
            <div class="topicdetailsection">
                <h3 class="topicdetailitemtitle">Units</h3>
                <div class="topicdetailgrid">
                    ${units.map((unit) => `
                        <a class="topicdetailitem" href="/topics/${encodeURIComponent(topicSlug)}/${encodeURIComponent(subtopicSlug)}/${encodeURIComponent(slugify(unit.name))}">
                            <span class="topicdetailitemtitle">${escapeHtml(unit.name)}</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `
        : '';

    try {
        const response = await fetch(`/api/problem-sets?topic=${encodeURIComponent(selectedTopic.topic)}&subtopic=${encodeURIComponent(selectedSubtopic.name)}`);
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const problemSets = await response.json();
        const problemSetMarkup = problemSets.length
            ? `
                <div class="problemsetgrid">
                    ${problemSets.map((problemSet) => renderProblemSetCard(problemSet)).join('')}
                </div>
            `
            : '<div class="problemsetempty"><p>No problem sets have been assigned to this subtopic yet.</p></div>';

        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/topics/${encodeURIComponent(topicSlug)}">Back to ${escapeHtml(selectedTopic.topic)}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${escapeHtml(selectedSubtopic.name)}</h2>
                        <span class="topicdetailitemmeta">${tagshtml}</span>
                    </div>
                    ${unitsHtml}
                    <div class="topicdetailsection">
                        <h3 class="topicdetailitemtitle">Problem Sets</h3>
                        ${problemSetMarkup}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Failed to load problem sets for subtopic:", error);
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/topics/${encodeURIComponent(topicSlug)}">Back to ${escapeHtml(selectedTopic.topic)}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${escapeHtml(selectedSubtopic.name)}</h2>
                        <span class="topicdetailitemmeta">${tagshtml}</span>
                    </div>
                    ${unitsHtml}
                    <div class="topicdetailsection">
                        <h3 class="topicdetailitemtitle">Problem sets</h3>
                        <div class="problemsetempty"><p>Unable to load problem sets for this subtopic right now.</p></div>
                    </div>
                </div>
            </div>
        `;
    }
}

async function renderUnitDetail(topics, topicSlug, subtopicSlug, unitSlug) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    const selectedTopic = topics.find(topic => slugify(topic.topic) === topicSlug);
    const selectedSubtopic = selectedTopic?.subtopics.find(subtopic => slugify(subtopic.name) === subtopicSlug);
    const selectedUnit = selectedSubtopic?.units?.find(unit => slugify(unit.name) === unitSlug);

    if (!selectedTopic || !selectedSubtopic || !selectedUnit) {
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/topics/">Back to all topics</a>
                <h1 class="topicdetailtitle">Unit not found</h1>
                <p class="topicdetailtext">We couldn't find that unit.</p>
            </div>
        `;
        return;
    }

    const backHref = `/topics/${encodeURIComponent(topicSlug)}/${encodeURIComponent(subtopicSlug)}`;

    try {
        const response = await fetch(`/api/problem-sets?topic=${encodeURIComponent(selectedTopic.topic)}&subtopic=${encodeURIComponent(selectedSubtopic.name)}&unit=${encodeURIComponent(selectedUnit.name)}`);
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const problemSets = await response.json();
        const problemSetMarkup = problemSets.length
            ? `
                <div class="problemsetgrid">
                    ${problemSets.map((problemSet) => renderProblemSetCard(problemSet)).join('')}
                </div>
            `
            : '<div class="problemsetempty"><p>No problem sets have been assigned to this unit yet.</p></div>';

        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="${backHref}">Back to ${escapeHtml(selectedSubtopic.name)}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${escapeHtml(selectedUnit.name)}</h2>
                    </div>
                    <div class="topicdetailsection">
                        <h3 class="topicdetailitemtitle">Problem sets</h3>
                        ${problemSetMarkup}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Failed to load problem sets for unit:", error);
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="${backHref}">Back to ${escapeHtml(selectedSubtopic.name)}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${escapeHtml(selectedUnit.name)}</h2>
                    </div>
                    <div class="topicdetailsection">
                        <h3 class="topicdetailitemtitle">Problem sets</h3>
                        <div class="problemsetempty"><p>Unable to load problem sets for this unit right now.</p></div>
                    </div>
                </div>
            </div>
        `;
    }
}


function applyTopicBackground(topicSlug) {
    const main = document.querySelector("main");
    if (!main) {
        return;
    }

    if (topicSlug) {
        main.classList.add("topicbg");
        main.style.setProperty("--topic-bg-image", `url(/images/topics/${encodeURIComponent(topicSlug)}.webp)`);
    } else {
        main.classList.remove("topicbg");
        main.style.removeProperty("--topic-bg-image");
    }
}

function toggleTopicNetworkLink(show) {
    const link = document.getElementById("topicnetworklink");
    if (link) {
        link.style.display = show ? "" : "none";
    }
}

async function courseLoad() {
    try {
        const response = await fetch('/api/topics');
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const topics = await response.json();
        const route = getTopicRoute();

        applyTopicBackground(route.topicSlug);
        toggleTopicNetworkLink(route.view === "index");

        if (route.view === "unit") {
            await renderUnitDetail(topics, route.topicSlug, route.subtopicSlug, route.unitSlug);
            return;
        }

        if (route.view === "subtopic") {
            await renderSubtopicDetail(topics, route.topicSlug, route.subtopicSlug);
            return;
        }

        if (route.view === "topic") {
            renderTopicDetail(topics, route.topicSlug);
            return;
        }

        renderTopicIndex(topics);
    } catch (error) {
        console.error("Failed to fetch topic catalog:", error);
    }
}

export { courseLoad };
