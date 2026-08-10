function toggleDropdown(button) {
    const dropdown = button.parentElement.nextElementSibling

    const isopen = dropdown.classList.toggle("show");
    button.classList.toggle("open", isopen);
}

function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getTopicRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get("topic");
    const subtopicParam = params.get("subtopic");

    if (parts[0] === "topics") {
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

function getProfileRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);

    if (parts[0] === "profile" && parts.length >= 2) {
        return {
            view: "profile",
            usernameSlug: parts[1]
        };
    }

    return { view: "none" };
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderMarkdown(value) {
    const escaped = escapeHtml(value || "");
    const withBreaks = escaped.replace(/\n/g, "<br>");
    const withParagraphs = withBreaks
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    return withParagraphs || "No bio yet.";
}

function insertMarkdownSnippet(textarea, prefix, suffix, placeholder, remove = false) {
    if (!textarea) {
        return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const prefixBefore = textarea.value.slice(Math.max(0, start - prefix.length), start);
    const suffixAfter = textarea.value.slice(end, end + suffix.length);

    if (remove || (prefixBefore === prefix && suffixAfter === suffix)) {
        const innerText = textarea.value.slice(start, end);
        const newValue = textarea.value.slice(0, start - prefix.length) + innerText + textarea.value.slice(end + suffix.length);

        textarea.value = newValue;
        textarea.focus();
        const cursorPosition = start - prefix.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition + innerText.length);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        return;
    }

    const textToWrap = selectedText || placeholder;
    const replacement = `${prefix}${textToWrap}${suffix}`;
    const newValue = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);

    textarea.value = newValue;
    textarea.focus();

    const cursorStart = start + prefix.length;
    const cursorEnd = cursorStart + textToWrap.length;
    textarea.setSelectionRange(cursorStart, cursorEnd);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyMarkdownToBio(action, remove = false) {
    const textarea = document.getElementById("bioInput");

    if (!textarea) {
        return;
    }

    switch (action) {
        case "bold":
            insertMarkdownSnippet(textarea, "**", "**", "", remove);
            break;
        case "italic":
            insertMarkdownSnippet(textarea, "*", "*", "", remove);
            break;
        case "link":
            insertMarkdownSnippet(textarea, "[", "](https://example.com)", "", remove);
            break;
        case "code":
            insertMarkdownSnippet(textarea, "`", "`", "", remove);
            break;
        default:
            break;
    }
}

function renderTopicIndex(topics) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    container.innerHTML = topics.map(topic => {
        const subtopicshtml = topic.subtopics.map(subtopic => {
            const tagarray = subtopic.tags ? subtopic.tags.split(', ') : [];
            const tagshtml = tagarray.map(tag => `
                    <span class="tag">(${tag})</span>
                `).join(' ');

            return `
                <a href="/topics/${encodeURIComponent(slugify(topic.topic))}/${encodeURIComponent(slugify(subtopic.name))}">
                    ${subtopic.name} ${tagshtml}
                </a>
            `;
        }).join(' ');

        return `
            <div class="topicboxes">
                <div class="topicheader">
                    <h3 class="topictitle">
                        <a class="topictitlelink" href="/topics/${encodeURIComponent(slugify(topic.topic))}">
                            ${topic.topic}
                        </a>
                    </h3>
                    <button class="dropdownbutton" onclick="toggleDropdown(this)">⌄</button>
                </div>
                <div class="dropdowncontent">
                    ${subtopicshtml || '<a href="#">No subtopics available</a>'}
                </div>
            </div>
        `;
    }).join(' ');
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
            const tagshtml = tagarray.map(tag => `<span class="tag">(${tag})</span>`).join(' ');

            return `
                <a class="topicdetailitem" id="${slugify(subtopic.name)}" href="/topics/${encodeURIComponent(topicSlug)}/${encodeURIComponent(slugify(subtopic.name))}">
                    <span class="topicdetailitemtitle">${subtopic.name}</span>
                    <span class="topicdetailitemmeta">${tagshtml}</span>
                </a>
            `;
        }).join('')
        : '<p class="topicdetailtext">No subtopics available yet.</p>';

    container.innerHTML = `
        <div class="topicdetail">
            <a class="topicdetailback" href="/topics/">Back to all topics</a>
            <h1 class="topicdetailtitle">${selectedTopic.topic}</h1>
            <div class="topicdetailgrid">
                ${subtopicshtml}
            </div>
        </div>
    `;
}

async function renderTopicNetworkPage() {
    const container = document.getElementById("coursecontainer");
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="topicnetworkpage">
            <div class="network-map-wrapper" id="network-map-wrapper">
                <div class="network-map-controls">
                    <button type="button" id="network-exit-button" class="network-exit-button">Back to Topics</button>
                    <button type="button" id="network-reset-button" class="network-reset-button">Reset view</button>
                    <button type="button" id="network-collapse-button" class="network-collapse-button">Collapse all</button>
                </div>
                <div class="network-map" id="network-map"></div>
            </div>
        </div>
    `;

    const exitButton = document.getElementById("network-exit-button");
    if (exitButton) {
        exitButton.addEventListener("click", () => {
            window.location.href = "/topics/";
        });
    }

    try {
        const apiUrl = (window.location.origin || '') + '/api/topics';
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const topics = await response.json();
        console.log('Topic network: loaded', Array.isArray(topics) ? topics.length : 'unknown', 'topics');
        initTopicNetworkMap(topics);
    } catch (error) {
        console.error('Failed to load topic network data:', error);
        const map = document.getElementById('network-map');
        if (map) {
            map.innerHTML = `
                <div class="network-map-instructions">
                    <div>Unable to load topic data right now.</div>
                    <div><small style="opacity:0.85">${escapeHtml(String(error && error.message))}</small></div>
                    <div style="margin-top:12px"><button id="network-retry-button">Retry</button></div>
                </div>
            `;

            const retry = document.getElementById('network-retry-button');
            if (retry) {
                retry.addEventListener('click', () => {
                    retry.disabled = true;
                    renderTopicNetworkPage();
                });
            }
        }
    }
}

function initTopicNetworkMap(topics = []) {
    const wrapper = document.getElementById("network-map-wrapper");
    const map = document.getElementById("network-map");
    const resetButton = document.getElementById("network-reset-button");
    const collapseButton = document.getElementById("network-collapse-button");

    if (!wrapper || !map) {
        return;
    }

    const centerX = 700;
    const centerY = 450;
    const outerRadius = 320;
    const totalTopics = topics.length || 1;

    const nodes = topics.map((topic, index) => {
        const angle = (index / totalTopics) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * outerRadius;
        const y = centerY + Math.sin(angle) * outerRadius;
        const label = topic.topic + (topic.subtopics?.length ? ` (${topic.subtopics.length})` : '');
        return { x, y, label };
    });

    if (!nodes.length) {
        nodes.push({ x: centerX, y: centerY, label: 'No topics found' });
    }

    const selectedTopicIndexes = new Set();

    const handleMapClick = (event) => {
        let target = event.target;
        if (!(target instanceof Element)) {
            target = target?.parentElement;
        }

        const node = target?.closest(".network-node");

        if (!node) {
            return;
        }

        const type = node.dataset.type;
        if (type === "topic") {
            const index = Number(node.dataset.index);
            if (!Number.isNaN(index)) {
                if (selectedTopicIndexes.has(index)) {
                    selectedTopicIndexes.delete(index);
                } else {
                    selectedTopicIndexes.add(index);
                }
                renderMap();
            }
        } else if (type === "subtopic") {
            const topicSlug = node.dataset.topicSlug;
            const subtopicSlug = node.dataset.subtopicSlug;
            if (topicSlug && subtopicSlug) {
                window.location.href = `/topics/${topicSlug}/${subtopicSlug}`;
            }
        }
    };

    // Attach click handler to wrapper so it receives events even when pointer capture is active
    wrapper.addEventListener("click", (ev) => {
        if (hasDragged) {
            return;
        }
        handleMapClick(ev);
    });
    renderMap();

    let scale = 1;
    let originX = 0;
    let originY = 0;
    let isDragging = false;
    let hasDragged = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialX = 0;
    let initialY = 0;
    const dragThreshold = 8;

    function updateTransform() {
        // Apply pan/zoom transform to the map element
        if (!map) return;
        map.style.transformOrigin = '0 0';
        map.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    }

    function getSubtopicLayout(parentNode, subtopics) {
        const total = subtopics.length;
        const baseRadius = 140;
        const maxPerRing = 6;
        const ringCount = Math.max(1, Math.ceil(total / maxPerRing));
        const parentAngle = Math.atan2(parentNode.y - centerY, parentNode.x - centerX);
        const layout = [];

        let offset = 0;
        for (let ring = 0; ring < ringCount; ring++) {
            const remaining = total - offset;
            const ringSize = Math.min(maxPerRing, remaining);
            const radius = baseRadius + ring * 90 + (ringSize > 4 ? 10 : 0);
            const arcWidth = Math.min(Math.PI * 1.9, Math.max(1.1, 0.35 * ringSize + 0.4));
            const step = ringSize > 1 ? arcWidth / (ringSize - 1) : 0;
            const startAngle = parentAngle - arcWidth / 2 + (ring % 2 === 1 ? step / 2 : 0);

            for (let idx = 0; idx < ringSize; idx++) {
                const angle = ringSize > 1 ? startAngle + idx * step : parentAngle + (ring % 2 === 1 ? 0.15 : -0.15);
                const x = parentNode.x + Math.cos(angle) * radius;
                const y = parentNode.y + Math.sin(angle) * radius;
                layout.push({ sub: subtopics[offset + idx], x, y });
            }

            offset += ringSize;
        }

        return layout;
    }

    function renderMap() {
        const topicLines = nodes.flatMap((start, i) => {
            return nodes.slice(i + 1).map((end) => `
                <line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />
            `);
        }).join("");

        const expandedSubtopicData = Array.from(selectedTopicIndexes).flatMap((index) => {
            const topic = topics[index];
            const parentNode = nodes[index] || { x: centerX, y: centerY };
            const layout = getSubtopicLayout(parentNode, topic?.subtopics || []);
            return layout.map(({ sub, x, y }) => ({
                line: `<line x1="${parentNode.x}" y1="${parentNode.y}" x2="${x}" y2="${y}" />`,
                markup: `<button type="button" class="network-node subtopic" data-type="subtopic" data-topic-slug="${encodeURIComponent(slugify(topic.topic))}" data-subtopic-slug="${encodeURIComponent(slugify(sub.name))}" style="left: ${x}px; top: ${y}px;">${escapeHtml(sub.name)}</button>`
            }));
        });

        const lines = `${topicLines}${expandedSubtopicData.map((item) => item.line).join("")}`;

        const nodeMarkup = nodes.map((node, index) => `
            <button type="button" class="network-node topic${selectedTopicIndexes.has(index) ? ' selected' : ''}" data-type="topic" data-index="${index}" style="left: ${node.x}px; top: ${node.y}px;">${escapeHtml(node.label)}</button>
        `).join("");

        const subtopicMarkup = expandedSubtopicData.map((item) => item.markup).join("");

        map.innerHTML = `
            <svg class="network-lines" viewBox="0 0 1400 900" preserveAspectRatio="xMinYMin meet">
                ${lines}
            </svg>
            ${nodeMarkup}
            ${subtopicMarkup}
        `;
    }

    wrapper.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) {
            return;
        }

        const path = event.composedPath ? event.composedPath() : [];
        const isControlTarget = path.some((node) => {
            return node instanceof Element && (node.matches && node.matches("button, a, input, textarea, select") || node.closest && (node.closest(".network-map-controls") || node.closest(".network-map-instructions")));
        });

        if (isControlTarget) {
            return;
        }

        event.preventDefault();
        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        initialX = originX;
        initialY = originY;
        wrapper.setPointerCapture(event.pointerId);
    });

    wrapper.addEventListener("pointermove", (event) => {
        if (!isDragging) {
            return;
        }

        event.preventDefault();
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;
        if (!hasDragged && Math.hypot(dx, dy) > dragThreshold) {
            hasDragged = true;
        }

        originX = initialX + dx;
        originY = initialY + dy;
        updateTransform();
    });

    const endDrag = () => {
        isDragging = false;
        setTimeout(() => {
            hasDragged = false;
        }, 0);
    };

    wrapper.addEventListener("pointerup", endDrag);
    wrapper.addEventListener("pointerleave", endDrag);
    wrapper.addEventListener("pointercancel", endDrag);

    wrapper.addEventListener("selectstart", (event) => {
        if (isDragging) {
            event.preventDefault();
        }
    });

    resetButton?.addEventListener("click", () => {
        scale = 1;
        originX = 0;
        originY = 0;
        updateTransform();
    });

    collapseButton?.addEventListener("click", () => {
        selectedTopicIndexes.clear();
        renderMap();
    });

    wrapper.addEventListener("wheel", (event) => {
        event.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;
        const beforeX = (pointerX - originX) / scale;
        const beforeY = (pointerY - originY) / scale;

        const zoomFactor = event.deltaY > 0 ? 1 / 1.08 : 1.08;
        const nextScale = Math.min(3, Math.max(0.5, scale * zoomFactor));
        const scaleRatio = nextScale / scale;
        scale = nextScale;

        originX = pointerX - beforeX * scale;
        originY = pointerY - beforeY * scale;
        updateTransform();
    }, { passive: false });

    updateTransform();
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
                <a class="topicdetailback" href="/topics/${encodeURIComponent(topicSlug)}">Back to ${selectedTopic.topic}</a>
                <h1 class="topicdetailtitle">Subtopic not found</h1>
                <p class="topicdetailtext">We couldn't find that subtopic inside this topic.</p>
            </div>
        `;
        return;
    }

    const tagarray = selectedSubtopic.tags ? selectedSubtopic.tags.split(', ') : [];
    const tagshtml = tagarray.map(tag => `<span class="tag">(${tag})</span>`).join(' ');

    try {
        const response = await fetch(`/api/problem-sets?topic=${encodeURIComponent(selectedTopic.topic)}&subtopic=${encodeURIComponent(selectedSubtopic.name)}`);
        const problemSets = await response.json();
        const problemSetMarkup = problemSets.length
            ? `
                <div class="problemsetgrid">
                    ${problemSets.map((problemSet) => `
                        <article class="problemsetcard">
                            <p class="problemsetid">Problem Set ID #${escapeHtml(problemSet.id)}</p>
                            <h2>${escapeHtml(problemSet.name)}</h2>
                            <p>${escapeHtml(problemSet.description || "No description available yet.")}</p>
                            <div class="problemsettags">
                                ${(problemSet.tags || []).map((tag) => `<span class="problemsettag">${escapeHtml(tag)}</span>`).join('')}
                            </div>
                        </article>
                    `).join('')}
                </div>
            `
            : '<div class="problemsetempty"><p>No problem sets have been assigned to this subtopic yet.</p></div>';

        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/topics/${encodeURIComponent(topicSlug)}">Back to ${selectedTopic.topic}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${selectedSubtopic.name}</h2>
                        <span class="topicdetailitemmeta">${tagshtml}</span>
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
                <a class="topicdetailback" href="/topics/${encodeURIComponent(topicSlug)}">Back to ${selectedTopic.topic}</a>
                <div class="topicdetailpanel">
                    <div class="topicdetailsectionheader">
                        <h2>${selectedSubtopic.name}</h2>
                        <span class="topicdetailitemmeta">${tagshtml}</span>
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
        <div class="problemsetgrid">
            ${problemSets.map((problemSet) => `
                <article class="problemsetcard">
                    <p class="problemsetid">Problem Set ID #${escapeHtml(problemSet.id)}</p>
                    <h2>${escapeHtml(problemSet.name)}</h2>
                    <p>${escapeHtml(problemSet.description || "No description available yet.")}</p>
                    <p class="problemsetmeta">${escapeHtml([problemSet.topic, problemSet.subtopic].filter(Boolean).join(" / ") || "Topic not assigned")}</p>
                    <div class="problemsettags">
                        ${(problemSet.tags || []).map((tag) => `<span class="problemsettag">${escapeHtml(tag)}</span>`).join('')}
                    </div>
                </article>
            `).join('')}
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

async function renderProfilePage() {
    const container = document.getElementById("profilecontainer");

    if (!container) {
        return;
    }

    const route = getProfileRoute();

    if (route.view !== "profile") {
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Profile not found</h1>
                <p class="topicdetailtext">This profile page could not be loaded.</p>
            </div>
        `;
        return;
    }

    try {
        const currentUserRaw = localStorage.getItem("currentUser");
        let currentUser = null;

        if (currentUserRaw) {
            try {
                currentUser = JSON.parse(currentUserRaw);
            } catch (error) {
                currentUser = null;
            }
        }

        const viewerUsername = currentUser?.username || null;
        const response = await fetch(`/api/users/${encodeURIComponent(route.usernameSlug)}${viewerUsername ? `?viewerUsername=${encodeURIComponent(viewerUsername)}` : ""}`);
        const data = await response.json();

        if (!response.ok) {
            container.innerHTML = `
                <div class="topicdetail">
                    <h1 class="topicdetailtitle">Profile not found</h1>
                </div>
            `;
            return;
        }

        const user = data.user;

        const isOwnProfile = currentUser && currentUser.username === user.username;
        const showEmail = isOwnProfile || user.publicEmail;
        const bioText = renderMarkdown(user.bio || "");

        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">${escapeHtml(user.username)}</h1>
                <div class="topicdetailpanel">
                    <p class="topicdetailtext"><span>User ID:</span> ${escapeHtml(user.id)}</p>
                    ${showEmail ? `<p class="topicdetailtext"><span>Email:</span> ${escapeHtml(user.email || "No email on file.")}</p>` : ""}
                    <p class="topicdetailtext"><span>Bio:</span></p>
                    <div class="profilebiooutput">${bioText}</div>
                </div>
                ${isOwnProfile ? `
                    <div class="profileactions">
                        <div class="profilecard">
                            <span class="profilesectiontitle">Edit public profile</span>
                            <form id="profileSettingsForm" class="profileform">
                                <label class="profilefieldlabel" for="bioInput">Bio</label>
                                <div class="markdowntoolbar">
                                    <button class="markdownbutton" type="button" data-markdown="bold">Bold</button>
                                    <button class="markdownbutton" type="button" data-markdown="italic">Italic</button>
                                    <button class="markdownbutton" type="button" data-markdown="link">Link</button>
                                    <button class="markdownbutton" type="button" data-markdown="code">Code</button>
                                </div>
                                <textarea id="bioInput" class="inputs profilebio" maxlength="1000" rows="8" placeholder="Tell people about yourself">${escapeHtml(user.bio || "")}</textarea>
                                <label class="profiletoggle">
                                    <input type="checkbox" id="publicEmailToggle" ${user.publicEmail ? "checked" : ""}>
                                    <span>Make my email public</span>
                                </label>
                                <button class="authsubmit" type="submit">Save profile</button>
                            </form>
                        </div>
                        <button id="openResetButton" class="resetbutton" type="button">Change Password</button>
                        <div id="resetPanel" class="resetpanel hidden">
                            <p class="topicdetailtext">We will send a verification code to the email linked to your account. It will expire in 15 minutes.</p>
                            <button id="sendResetButton" class="resetbutton" type="button">Send Verification Code</button>
                            <div id="resetStatus" class="resetstatus"></div>
                            <form id="resetVerifyForm" class="resetform hidden">
                                <label for="reset-code">Verification Code</label>
                                <input class="inputs resetinput" type="text" id="reset-code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="Enter 6-digit code">
                                <label for="reset-new-password">New Password</label>
                                <input class="inputs resetinput" type="password" id="reset-new-password" autocomplete="new-password" placeholder="Enter your new password">
                                <button class="authsubmit" type="submit">Update Password</button>
                            </form>
                        </div>
                        <button id="logoutButton" class="resetbutton logoutbutton" type="button">Logout</button>
                    </div>
                ` : ''}
            </div>
        `;

        const openResetButton = document.getElementById("openResetButton");
        const resetPanel = document.getElementById("resetPanel");
        const sendResetButton = document.getElementById("sendResetButton");
        const resetStatus = document.getElementById("resetStatus");
        const resetVerifyForm = document.getElementById("resetVerifyForm");
        const logoutButton = document.getElementById("logoutButton");
        const profileSettingsForm = document.getElementById("profileSettingsForm");
        const bioInput = document.getElementById("bioInput");
        const publicEmailToggle = document.getElementById("publicEmailToggle");
        const markdownButtons = document.querySelectorAll(".markdownbutton");

        markdownButtons.forEach((button) => {
            button.addEventListener("click", () => applyMarkdownToBio(button.dataset.markdown));
            button.addEventListener("dblclick", (event) => {
                event.preventDefault();
                applyMarkdownToBio(button.dataset.markdown, true);
            });
        });

        if (profileSettingsForm && bioInput && publicEmailToggle) {
            profileSettingsForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                try {
                    const response = await fetch(`/api/users/${encodeURIComponent(route.usernameSlug)}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            viewerUsername: currentUser?.username,
                            bio: bioInput.value,
                            publicEmail: publicEmailToggle.checked
                        })
                    });

                    if (!response.ok) {
                        return;
                    }

                    window.location.reload();
                } catch (error) {
                    console.error("Failed to update profile:", error);
                }
            });
        }

        if (openResetButton && resetPanel) {
            openResetButton.addEventListener("click", () => {
                resetPanel.classList.remove("hidden");
                openResetButton.classList.add("hidden");
            });
        }

        if (sendResetButton && resetStatus && resetVerifyForm) {
            sendResetButton.addEventListener("click", async () => {
                resetStatus.textContent = "Sending code...";

                try {
                    const response = await fetch("/api/password-reset/request", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username: route.usernameSlug })
                    });

                    const data = await response.json();
                    if (data.verificationCode) {
                        resetStatus.textContent = `${data.message || "Verification code generated locally."} Code: ${data.verificationCode}`;
                    } else {
                        resetStatus.textContent = data.message || "Verification code sent.";
                    }
                    resetVerifyForm.classList.remove("hidden");
                    sendResetButton.classList.add("hidden");
                } catch (error) {
                    console.error("Failed to request password reset:", error);
                    resetStatus.textContent = "Unable to send verification code.";
                }
            });
        }

        if (resetVerifyForm && resetStatus) {
            resetVerifyForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                const code = document.getElementById("reset-code").value;
                const newPassword = document.getElementById("reset-new-password").value;
                resetStatus.textContent = "Updating password...";

                try {
                    const response = await fetch("/api/password-reset/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code,
                            newPassword
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        resetStatus.textContent = data.message || "Password update failed.";
                        return;
                    }

                    localStorage.removeItem("currentUser");
                    window.location.href = "/login/";
                } catch (error) {
                    console.error("Failed to update password:", error);
                    resetStatus.textContent = "Password update failed.";
                }
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener("click", () => {
                localStorage.removeItem("currentUser");
                window.location.href = "/login/";
            });
        }
    } catch (error) {
        console.error("Failed to load user profile:", error);
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Profile unavailable</h1>
                <p class="topicdetailtext">We couldn't load this profile right now.</p>
            </div>
        `;
    }
}

const toggle = document.getElementById("themetoggler");

if (toggle) {
    toggle.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark");

        if (isDark) {
            localStorage.setItem("theme", "dark");
            toggle.textContent = "Light Mode";
        } else {
            localStorage.setItem("theme", "light");
            toggle.textContent = "Dark Mode";
        }

        document.dispatchEvent(new CustomEvent("themechange", { detail: { dark: isDark } }));
    });
}

const prefersDarkScheme = typeof window.matchMedia === 'function'
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;

if (
    localStorage.getItem("theme") === "dark" ||
    (!localStorage.getItem("theme") && prefersDarkScheme)
) {
    document.body.classList.add("dark");
    const toggle = document.getElementById("themetoggler");
    if (toggle) {
        toggle.textContent = "Light Mode";
    }
}

async function pingServer() {

    try {
        const response = await fetch('/api/status');
        const data = await response.json();
    } catch (error) {
        console.error("Failed to connect to the backend:", error);
    }
}

async function courseLoad() {
    try {
        const response = await fetch('/api/topics');
        const topics = await response.json();
        const route = getTopicRoute();

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

async function updateProblemSetCount() {
    try {
        const response = await fetch('/api/problem-sets/count');
        const data = await response.json();
        const problemsLink = document.querySelector('#problems-count-link .boxtitle');

        if (problemsLink && typeof data.count === 'number') {
            problemsLink.textContent = `${data.count} Problem Set${data.count === 1 ? '' : 's'}`;
        }
    } catch (error) {
        console.error('Failed to fetch problem set count:', error);
    }
}

async function updateTopicCount() {
    try {
        const response = await fetch('/api/topics/count');
        const data = await response.json();
        const topicsLink = document.querySelector('#topics-count-link .boxtitle');

        if (topicsLink && typeof data.count === 'number') {
            topicsLink.textContent = `${data.count} Topic${data.count === 1 ? '' : 's'}`;
        }
    } catch (error) {
        console.error('Failed to fetch topic count:', error);
    }
}

function checkUserStatus() {
    const userStatus = localStorage.getItem("currentUser");
    if (!userStatus) return;

    try {
        const parsed = JSON.parse(userStatus);
        const user = parsed.user || parsed;
        const loginLinks = document.querySelectorAll("a[href='/login/']");

        loginLinks.forEach((link) => {
            const listItem = link.parentElement;
            const displayName = escapeHtml(user.username || "Profile");

            if (listItem && listItem.parentElement && listItem.parentElement.classList.contains("tablist")) {
                listItem.innerHTML = `
                    <a class="profilemenulink" href="/profile/${encodeURIComponent(user.username)}">${displayName}</a>
                `;
                return;
            }

            link.textContent = displayName;
            link.href = `/profile/${encodeURIComponent(user.username)}`;
            link.classList.remove("login");
            link.classList.add("profilemenulink");
        });
    } catch (error) {
        console.error("Error checking user status:", error);
    }
}

async function submitProblemSetSuggestion(event) {
    if (event) {
        event.preventDefault();
    }

    const statusElement = document.getElementById("suggestion-status");
    const form = document.getElementById("suggest-problem-set-form");
    if (!form || !statusElement) {
        return;
    }

    statusElement.textContent = "Submitting suggestion...";

    const problems = serializeProblemItems();
    if (!problems.length) {
        statusElement.textContent = "Please add at least one problem.";
        return;
    }

    const payload = {
        name: document.getElementById("suggest-name").value.trim(),
        topic: document.getElementById("suggest-topic").value.trim(),
        subtopic: document.getElementById("suggest-subtopic").value.trim(),
        tags: document.getElementById("suggest-tags").value.trim(),
        description: document.getElementById("suggest-description").value.trim(),
        problems: JSON.stringify(problems),
        submitter: null
    };

    const currentUserRaw = localStorage.getItem("currentUser");
    if (currentUserRaw) {
        try {
            const parsed = JSON.parse(currentUserRaw);
            const user = parsed.user || parsed;
            payload.submitter = user.username || null;
        } catch (error) {
            // ignore malformed user data
        }
    }

    if (!payload.name || !payload.topic || !payload.subtopic || !problems.length) {
        statusElement.textContent = "Please complete all required fields.";
        return;
    }

    try {
        const response = await fetch("/api/problem-set-suggestions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            statusElement.textContent = data.message || "Unable to submit your suggestion.";
            return;
        }

        statusElement.textContent = data.message || "Suggestion received. Thank you!";
        form.reset();
    } catch (error) {
        console.error("Failed to submit suggestion:", error);
        statusElement.textContent = "Unable to submit your suggestion right now.";
    }
}

function serializeProblemItems() {
    const items = Array.from(document.querySelectorAll('.problem-item'));
    return items.map((item) => {
        const prompt = item.querySelector('.problem-prompt').value.trim();
        const type = item.querySelector('.problem-type').value;
        const answer = item.querySelector('.problem-answer').value.trim();
        const choices = type === 'multiple_choice'
            ? Array.from(item.querySelectorAll('.choice-input')).map(choice => choice.value.trim()).filter(Boolean)
            : [];

        return { prompt, type, choices, answer };
    }).filter(problem => problem.prompt && problem.type && problem.answer && (problem.type !== 'multiple_choice' || problem.choices.length > 0));
}

function removeProblemItem(button) {
    const item = button.closest('.problem-item');
    if (item) {
        item.remove();
    }
}

function updateProblemItemTypeFields(item) {
    const type = item.querySelector('.problem-type').value;
    const choiceLabel = item.querySelector('.problem-choice-label');
    const choiceList = item.querySelector('.problem-choice-list');
    const answerLabel = item.querySelector('.problem-answer-label');
    const answerInput = item.querySelector('.problem-answer');
    const choiceInputs = Array.from(item.querySelectorAll('.choice-input'));

    if (type === 'free_response') {
        if (choiceLabel) {
            choiceLabel.textContent = 'Acceptable Answers';
        }
        if (choiceList) {
            choiceList.style.display = 'none';
        }
        choiceInputs.forEach(input => {
            input.required = false;
        });
        if (answerLabel) {
            answerLabel.style.display = 'None';
        }
        if (answerInput) {
            answerInput.placeholder = 'Enter acceptable answers separated by commas:';
        }
    } else {
        if (choiceLabel) {
            choiceLabel.textContent = 'Answer Choices';
        }
        if (choiceList) {
            choiceList.style.display = '';
        }
        choiceInputs.forEach(input => {
            input.required = true;
        });
        if (answerLabel) {
            answerLabel.style.display = '';
            answerLabel.textContent = 'Correct Answer';
        }
        if (answerInput) {
            answerInput.placeholder = 'Enter the correct choice:';
        }
    }
}

function addProblemItem() {
    const container = document.getElementById('problem-items');
    if (!container) {
        return;
    }

    const problemIndex = container.children.length + 1;
    const template = document.createElement('div');
    template.className = 'problem-item';
    template.innerHTML = `
        <div class="problem-item-header">
            <span class="aboutustitle">Problem ${problemIndex}</span>
            <button type="button" class="authsubmit remove-problem-button">Remove</button>
        </div>
        <label class="aboutustitle">Problem Type</label>
        <select class="inputs problem-type">
            <option value="multiple_choice">Multiple Choice</option>
            <option value="free_response">Free Response</option>
        </select>
        <label class="aboutustitle">Prompt</label>
        <textarea class="inputs problem-prompt" rows="4" placeholder="Enter here:" required></textarea>
        <label class="aboutustitle problem-choice-label">Answer Choices</label>
        <div class="problem-choice-list">
            <input class="inputs choice-input" type="text" placeholder="Choice A" required>
            <input class="inputs choice-input" type="text" placeholder="Choice B" required>
            <input class="inputs choice-input" type="text" placeholder="Choice C" required>
            <input class="inputs choice-input" type="text" placeholder="Choice D" required>
        </div>
        <label class="aboutustitle problem-answer-label">Correct Answer</label>
        <input class="inputs problem-answer" type="text" placeholder="Enter the correct choice:" required>
    `;

    container.appendChild(template);
    const removeButton = template.querySelector('.remove-problem-button');
    removeButton.addEventListener('click', () => removeProblemItem(removeButton));

    const typeSelect = template.querySelector('.problem-type');
    if (typeSelect) {
        typeSelect.addEventListener('change', () => updateProblemItemTypeFields(template));
    }

    updateProblemItemTypeFields(template);
}

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

document.addEventListener("DOMContentLoaded", () => {
    checkUserStatus();
    initUserSearch();

    const profileRoute = getProfileRoute();
    const isProblemsRoute = window.location.pathname.startsWith("/problems");

    if (profileRoute.view === "profile") {
        renderProfilePage();
    } else if (window.location.pathname.startsWith("/contribute")) {
        const suggestForm = document.getElementById("suggest-problem-set-form");
        const addProblemButton = document.getElementById("add-problem-button");

        if (suggestForm) {
            suggestForm.addEventListener("submit", submitProblemSetSuggestion);
        }

        if (addProblemButton) {
            addProblemButton.addEventListener("click", addProblemItem);
        }

        addProblemItem();
    } else if (window.location.pathname.startsWith("/topics/network")) {
        renderTopicNetworkPage();
    } else if (isProblemsRoute) {
        initProblemSetSearch();
    } else {
        courseLoad();
        updateProblemSetCount();
        updateTopicCount();
    }
    pingServer();
});
