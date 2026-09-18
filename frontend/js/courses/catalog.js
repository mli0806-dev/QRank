import { escapeHtml, slugify } from '../core/dom.js';
import { renderProblemSetCard } from '../problem-sets/search.js';

function toggleDropdown(button) {
    const dropdown = button.parentElement.nextElementSibling

    const isopen = dropdown.classList.toggle("show");
    button.classList.toggle("open", isopen);
}


function getCourseRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    const params = new URLSearchParams(window.location.search);
    const courseParam = params.get("course");
    const topicParam = params.get("topic");

    if (parts[0] === "courses") {
        if (parts.length >= 4) {
            return {
                view: "subtopic",
                courseSlug: parts[1],
                topicSlug: parts[2],
                subtopicSlug: parts[3]
            };
        }

        if (parts.length >= 3) {
            return {
                view: "topic",
                courseSlug: parts[1],
                topicSlug: parts[2]
            };
        }

        if (parts.length >= 2) {
            return {
                view: "course",
                courseSlug: parts[1]
            };
        }

        return { view: "index" };
    }

    if (courseParam && topicParam) {
        return {
            view: "topic",
            courseSlug: courseParam,
            topicSlug: topicParam
        };
    }

    if (courseParam) {
        return {
            view: "course",
            courseSlug: courseParam
        };
    }

    return { view: "index" };
}

function renderCourseIndex(courses) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    container.innerHTML = courses.map(course => {
        const topicshtml = course.topics.map(topic => {
            const tagarray = topic.tags ? topic.tags.split(', ') : [];
            const tagshtml = renderParenTags(tagarray);

            return `
                <a href="/courses/${encodeURIComponent(slugify(course.course))}/${encodeURIComponent(slugify(topic.name))}">
                    ${escapeHtml(topic.name)} ${tagshtml}
                </a>
            `;
        }).join(' ');

        return `
            <div class="courseboxes">
                <div class="courseheader">
                    <h3 class="coursetitle">
                        <a class="coursetitlelink" href="/courses/${encodeURIComponent(slugify(course.course))}">
                            ${escapeHtml(course.course)}
                        </a>
                    </h3>
                    <button class="dropdownbutton">⌄</button>
                </div>
                <div class="dropdowncontent">
                    ${topicshtml || '<a href="#">No topics available</a>'}
                </div>
            </div>
        `;
    }).join(' ');

    container.querySelectorAll(".dropdownbutton").forEach((button) => {
        button.addEventListener("click", () => toggleDropdown(button));
    });
}

function renderCourseDetail(courses, courseSlug) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    const selectedCourse = courses.find(course => slugify(course.course) === courseSlug);

    if (!selectedCourse) {
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Course not found</h1>
                <p class="topicdetailtext">We couldn't find that course. Go back to the <a href="/courses/">course gallery</a> and try another one.</p>
            </div>
        `;
        return;
    }

    const topicshtml = selectedCourse.topics.length
        ? selectedCourse.topics.map(topic => {
            const tagarray = topic.tags ? topic.tags.split(', ') : [];
            const tagshtml = renderParenTags(tagarray);

            return `
                <a class="topicdetailitem" id="${slugify(topic.name)}" href="/courses/${encodeURIComponent(courseSlug)}/${encodeURIComponent(slugify(topic.name))}">
                    <span class="topicdetailitemtitle">${escapeHtml(topic.name)}</span>
                    <span class="topicdetailitemmeta">${tagshtml}</span>
                </a>
            `;
        }).join('')
        : '<p class="topicdetailtext">No topics available yet.</p>';

    container.innerHTML = `
        <div class="topicdetail topicdetail-${escapeHtml(courseSlug)}">
            <a class="topicdetailback" href="/courses/">Back to all courses</a>
            <h1 class="topicdetailtitle">${escapeHtml(selectedCourse.course)}</h1>
            <div class="topicdetailgrid">
                ${topicshtml}
            </div>
        </div>
    `;
}

function renderParenTags(tagarray) {
    return tagarray.map(tag => `<span class="tag">(${escapeHtml(tag)})</span>`).join(' ');
}


async function renderTopicDetail(courses, courseSlug, topicSlug) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    const selectedCourse = courses.find(course => slugify(course.course) === courseSlug);

    if (!selectedCourse) {
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Course not found</h1>
                <p class="topicdetailtext">We couldn't find that course. Go back to the <a href="/courses/">course gallery</a> and try another one.</p>
            </div>
        `;
        return;
    }

    const selectedTopic = selectedCourse.topics.find(topic => slugify(topic.name) === topicSlug);

    if (!selectedTopic) {
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/courses/${encodeURIComponent(courseSlug)}">Back to ${escapeHtml(selectedCourse.course)}</a>
                <h1 class="topicdetailtitle">Topic not found</h1>
                <p class="topicdetailtext">We couldn't find that topic inside this course.</p>
            </div>
        `;
        return;
    }

    const tagarray = selectedTopic.tags ? selectedTopic.tags.split(', ') : [];
    const tagshtml = renderParenTags(tagarray);

    const subtopics = selectedTopic.subtopics || [];
    const subtopicsHtml = subtopics.length
        ? `
            <div class="topicdetailsection">
                <h3 class="topicdetailitemtitle">Subtopics</h3>
                <div class="topicdetailgrid">
                    ${subtopics.map((subtopic) => `
                        <a class="topicdetailitem" href="/courses/${encodeURIComponent(courseSlug)}/${encodeURIComponent(topicSlug)}/${encodeURIComponent(slugify(subtopic.name))}">
                            <span class="topicdetailitemtitle">${escapeHtml(subtopic.name)}</span>
                        </a>
                    `).join('')}
                </div>
            </div>
        `
        : '';

    try {
        const response = await fetch(`/api/problem-sets?course=${encodeURIComponent(selectedCourse.course)}&topic=${encodeURIComponent(selectedTopic.name)}`);
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
            : '<div class="problemsetempty"><p>No problem sets have been assigned to this topic yet.</p></div>';

        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/courses/${encodeURIComponent(courseSlug)}">Back to ${escapeHtml(selectedCourse.course)}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${escapeHtml(selectedTopic.name)}</h2>
                        <span class="topicdetailitemmeta">${tagshtml}</span>
                    </div>
                    ${subtopicsHtml}
                    <div class="topicdetailsection">
                        <h3 class="topicdetailitemtitle">Problem Sets</h3>
                        ${problemSetMarkup}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Failed to load problem sets for topic:", error);
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/courses/${encodeURIComponent(courseSlug)}">Back to ${escapeHtml(selectedCourse.course)}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${escapeHtml(selectedTopic.name)}</h2>
                        <span class="topicdetailitemmeta">${tagshtml}</span>
                    </div>
                    ${subtopicsHtml}
                    <div class="topicdetailsection">
                        <h3 class="topicdetailitemtitle">Problem sets</h3>
                        <div class="problemsetempty"><p>Unable to load problem sets for this topic right now.</p></div>
                    </div>
                </div>
            </div>
        `;
    }
}

async function renderSubtopicDetail(courses, courseSlug, topicSlug, subtopicSlug) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    const selectedCourse = courses.find(course => slugify(course.course) === courseSlug);
    const selectedTopic = selectedCourse?.topics.find(topic => slugify(topic.name) === topicSlug);
    const selectedSubtopic = selectedTopic?.subtopics?.find(subtopic => slugify(subtopic.name) === subtopicSlug);

    if (!selectedCourse || !selectedTopic || !selectedSubtopic) {
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/courses/">Back to all courses</a>
                <h1 class="topicdetailtitle">Subtopic not found</h1>
                <p class="topicdetailtext">We couldn't find that subtopic.</p>
            </div>
        `;
        return;
    }

    const backHref = `/courses/${encodeURIComponent(courseSlug)}/${encodeURIComponent(topicSlug)}`;

    try {
        const response = await fetch(`/api/problem-sets?course=${encodeURIComponent(selectedCourse.course)}&topic=${encodeURIComponent(selectedTopic.name)}&subtopic=${encodeURIComponent(selectedSubtopic.name)}`);
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
                <a class="topicdetailback" href="${backHref}">Back to ${escapeHtml(selectedTopic.name)}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${escapeHtml(selectedSubtopic.name)}</h2>
                    </div>
                    <div class="topicdetailsection">
                        <h3 class="topicdetailitemtitle">Problem sets</h3>
                        ${problemSetMarkup}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error("Failed to load problem sets for subtopic:", error);
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="${backHref}">Back to ${escapeHtml(selectedTopic.name)}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${escapeHtml(selectedSubtopic.name)}</h2>
                    </div>
                    <div class="topicdetailsection">
                        <h3 class="topicdetailitemtitle">Problem sets</h3>
                        <div class="problemsetempty"><p>Unable to load problem sets for this subtopic right now.</p></div>
                    </div>
                </div>
            </div>
        `;
    }
}


function applyCourseBackground(courseSlug) {
    const main = document.querySelector("main");
    if (!main) {
        return;
    }

    if (courseSlug) {
        main.classList.add("coursebg");
        main.style.setProperty("--course-bg-image", `url(/images/courses/${encodeURIComponent(courseSlug)}.webp)`);
    } else {
        main.classList.remove("coursebg");
        main.style.removeProperty("--course-bg-image");
    }
}

function toggleCourseNetworkLink(show) {
    const link = document.getElementById("coursenetworklink");
    if (link) {
        link.style.display = show ? "" : "none";
    }
}

async function courseLoad() {
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const courses = await response.json();
        const route = getCourseRoute();

        applyCourseBackground(route.courseSlug);
        toggleCourseNetworkLink(route.view === "index");

        if (route.view === "subtopic") {
            await renderSubtopicDetail(courses, route.courseSlug, route.topicSlug, route.subtopicSlug);
            return;
        }

        if (route.view === "topic") {
            await renderTopicDetail(courses, route.courseSlug, route.topicSlug);
            return;
        }

        if (route.view === "course") {
            renderCourseDetail(courses, route.courseSlug);
            return;
        }

        renderCourseIndex(courses);
    } catch (error) {
        console.error("Failed to fetch course catalog:", error);
    }
}

export { courseLoad };
