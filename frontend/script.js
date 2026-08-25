(function loadVercelSpeedInsights() {
    const script = document.createElement("script");
    script.defer = true;
    script.src = "/_vercel/speed-insights/script.js";
    document.head.appendChild(script);
})();

function injectHeaderFooter() {
    const nav = document.querySelector("nav.headerbox");
    if (nav) {
        const minimal = nav.dataset.navVariant === "minimal";
        nav.innerHTML = minimal ? `
            <div class="left">
                <a href="/" class="sitetitle"><img src="/images/logo.png?v=3" alt="QRank" class="sitetitlelogo"></a>
            </div>
            <div class="right">
                <button id="themetoggler" class="themebutton">Dark Mode</button>
            </div>
        ` : `
            <div class="left">
                <a href="/" class="sitetitle"><img src="/images/logo.png?v=3" alt="QRank" class="sitetitlelogo"></a>
                <ul class="tablist">
                    <li><a class="tabitems" href="/topics/">Topics</a></li>
                    <li><a class="tabitems" href="/problems/">Problem Sets</a></li>
                    <li><a class="tabitems" href="/competitions/">Competitions</a></li>
                    <li><a class="tabitems" href="/rankings/">Rankings</a></li>
                    <li><a class="tabitems" href="/about/">About Us</a></li>
                    <li><a class="tabitems" href="/contribute/">Contribute</a></li>
                </ul>
            </div>
            <div class="right">
                <button id="themetoggler" class="themebutton">Dark Mode</button>
                <a class="login" href="/login/">Login</a>
            </div>
        `;
    }

    const footer = document.querySelector("footer.sitefooter");
    if (footer) {
        footer.innerHTML = `© 2026 QRank. All rights reserved. · <a class="footerlink" href="/tos/">Terms of Service</a> · <a class="footerlink" href="/privacy/">Privacy Policy</a>`;
    }
}

injectHeaderFooter();

function initMobileNav() {
    const headerLeft = document.querySelector(".headerbox .left");
    const tablist = document.querySelector(".headerbox .tablist");
    if (!headerLeft || !tablist || headerLeft.querySelector(".navtoggle")) {
        return;
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "navtoggle";
    toggle.setAttribute("aria-label", "Toggle navigation menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "☰";
    headerLeft.insertBefore(toggle, tablist);

    const closeMenu = () => {
        tablist.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰";
    };

    toggle.addEventListener("click", () => {
        const isOpen = tablist.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.textContent = isOpen ? "✕" : "☰";
    });

    tablist.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
            closeMenu();
        }
    });

    document.addEventListener("click", (event) => {
        if (!tablist.classList.contains("open")) {
            return;
        }
        const target = event.target;
        if (target instanceof Element && (tablist.contains(target) || toggle.contains(target))) {
            return;
        }
        closeMenu();
    });
}

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

let currentUserPromise = null;

function getCurrentUser() {
    if (!currentUserPromise) {
        currentUserPromise = fetch("/api/auth/me")
            .then(response => (response.ok ? response.json() : null))
            .then(data => data?.user || null)
            .catch(() => null);
    }

    return currentUserPromise;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

let markdownLinkHookInstalled = false;
function ensureMarkdownLinkHook() {
    if (markdownLinkHookInstalled || typeof DOMPurify === 'undefined') {
        return;
    }

    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
        if (node.tagName === 'A') {
            node.setAttribute('target', '_blank');
            node.setAttribute('rel', 'noopener noreferrer');
        }
    });

    markdownLinkHookInstalled = true;
}

function renderMarkdown(value, emptyFallback = "No bio yet.") {
    const text = String(value || "").trim();

    if (!text) {
        return emptyFallback;
    }

    if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
        return escapeHtml(text);
    }

    ensureMarkdownLinkHook();
    return DOMPurify.sanitize(marked.parse(text, { breaks: true }));
}

function autoResizeTextarea(textarea) {
    if (!textarea) {
        return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
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

function applyMarkdownToTextarea(textarea, action, remove = false) {
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

function applyMarkdownToBio(action, remove = false) {
    applyMarkdownToTextarea(document.getElementById("bioInput"), action, remove);
}

function initMarkdownToolbar(toolbarSelector, textarea) {
    document.querySelectorAll(toolbarSelector).forEach((button) => {
        button.addEventListener("click", () => applyMarkdownToTextarea(textarea, button.dataset.markdown));
        button.addEventListener("dblclick", (event) => {
            event.preventDefault();
            applyMarkdownToTextarea(textarea, button.dataset.markdown, true);
        });
    });
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
        <div class="topicdetail topicdetail-${topicSlug}">
            <a class="topicdetailback" href="/topics/">Back to all topics</a>
            <h1 class="topicdetailtitle">${escapeHtml(selectedTopic.topic)}</h1>
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
    const totalTopics = topics.length || 1;

    let measureContext = null;
    function measureLabelWidth(label) {
        if (!measureContext) {
            measureContext = document.createElement('canvas').getContext('2d');
            measureContext.font = '14px D-DIN, sans-serif';
        }
        return measureContext.measureText(label).width;
    }

    const NODE_HALF_HEIGHT = 23;
    const NODE_GAP = 40;
    const SUBTOPIC_CONE_HALF_ANGLE = Math.PI / 3; 
    function clampAngleToCone(angle, centerAngle, halfAngle) {
        const diff = Math.atan2(Math.sin(angle - centerAngle), Math.cos(angle - centerAngle));
        return centerAngle + Math.max(-halfAngle, Math.min(halfAngle, diff));
    }

    function nodeHalfWidth(label, horizontalPadding) {
        return Math.max(140, measureLabelWidth(label) + horizontalPadding) / 2;
    }

    function boxesOverlap(a, b) {
        return Math.abs(a.x - b.x) < (a.halfW + b.halfW + NODE_GAP) &&
            Math.abs(a.y - b.y) < (a.halfH + b.halfH + NODE_GAP);
    }

    const topicLabels = topics.map((topic) => topic.topic + (topic.subtopics?.length ? ` (${topic.subtopics.length})` : ''));

    const maxTopicHalfWidth = Math.max(70, ...topicLabels.map((label) => nodeHalfWidth(label, 32)));
    const angleStep = (Math.PI * 2) / totalTopics;
    const requiredRadius = totalTopics > 1
        ? (maxTopicHalfWidth * 2 + NODE_GAP) / (2 * Math.sin(angleStep / 2))
        : 0;
    const outerRadius = Math.max(320, requiredRadius);

    function getTopicLightness() {
        return document.body.classList.contains('dark') ? 80 : 40;
    }

    function getNeutralLightness() {
        return document.body.classList.contains('dark') ? 50 : 35;
    }

    const nodes = topics.map((topic, index) => {
        const angle = (index / totalTopics) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * outerRadius;
        const y = centerY + Math.sin(angle) * outerRadius;
        const hue = (index / totalTopics) * 360;
        return { x, y, label: topicLabels[index], slug: slugify(topic.topic), hue, color: `hsl(${hue}, 50%, ${getTopicLightness()}%)` };
    });

    if (!nodes.length) {
        nodes.push({ x: centerX, y: centerY, label: 'No topics found', color: `hsl(0, 0%, ${getNeutralLightness()}%)` });
    }

    function refreshNodeColors() {
        const topicLightness = getTopicLightness();
        const neutralLightness = getNeutralLightness();
        nodes.forEach((node) => {
            node.color = typeof node.hue === 'number'
                ? `hsl(${node.hue}, 50%, ${topicLightness}%)`
                : `hsl(0, 0%, ${neutralLightness}%)`;
        });
    }

    const selectedTopicIndexes = new Set();
    const selectedSubtopicKeys = new Set();

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
            const topicIndex = Number(node.dataset.topicIndex);
            const subtopicIndex = Number(node.dataset.subtopicIndex);
            if (!Number.isNaN(topicIndex) && !Number.isNaN(subtopicIndex)) {
                const key = `${topicIndex}-${subtopicIndex}`;
                if (selectedSubtopicKeys.has(key)) {
                    selectedSubtopicKeys.delete(key);
                } else {
                    selectedSubtopicKeys.add(key);
                }
                renderMap();
            }
        } else if (type === "unit") {
            navigateToUnitNode(node);
        }
    };

    function navigateToUnitNode(node) {
        const topicSlug = node.dataset.topicSlug;
        const subtopicSlug = node.dataset.subtopicSlug;
        const unitSlug = node.dataset.unitSlug;
        if (topicSlug && subtopicSlug && unitSlug) {
            window.location.href = `/topics/${topicSlug}/${subtopicSlug}/${unitSlug}`;
        }
    }

    wrapper.addEventListener("click", (ev) => {
        if (hasDragged) {
            return;
        }
        handleMapClick(ev);
    });

    wrapper.addEventListener("contextmenu", (event) => {
        let target = event.target;
        if (!(target instanceof Element)) {
            target = target?.parentElement;
        }

        const node = target?.closest(".network-node");
        if (!node) {
            return;
        }

        event.preventDefault();

        const type = node.dataset.type;
        if (type === "topic") {
            const topicSlug = node.dataset.topicSlug;
            if (topicSlug) {
                window.location.href = `/topics/${topicSlug}`;
            }
        } else if (type === "subtopic") {
            const topicSlug = node.dataset.topicSlug;
            const subtopicSlug = node.dataset.subtopicSlug;
            if (topicSlug && subtopicSlug) {
                window.location.href = `/topics/${topicSlug}/${subtopicSlug}`;
            }
        } else if (type === "unit") {
            navigateToUnitNode(node);
        }
    });

    function getSubtopicAngles(parentNode, subtopics) {
        const baseRadius = 200;
        const ringGap = 150;
        const maxRingArc = SUBTOPIC_CONE_HALF_ANGLE * 2;
        const nodeHorizontalPadding = 36;
        const parentAngle = Math.atan2(parentNode.y - centerY, parentNode.x - centerX);
        const layout = [];
        let remaining = subtopics.slice();
        let ring = 0;

        while (remaining.length) {
            const radius = baseRadius + ring * ringGap;
            const ringItems = [];
            let usedArc = 0;

            while (remaining.length) {
                const sub = remaining[0];
                const angularWidth = (measureLabelWidth(sub.name) + nodeHorizontalPadding + NODE_GAP) / radius;
                if (ringItems.length > 0 && usedArc + angularWidth > maxRingArc) {
                    break;
                }
                ringItems.push({ sub, angularWidth });
                usedArc += angularWidth;
                remaining.shift();
            }

            let angleCursor = parentAngle - usedArc / 2;
            for (const { sub, angularWidth } of ringItems) {
                const angle = angleCursor + angularWidth / 2;
                layout.push({ sub, angle, radius });
                angleCursor += angularWidth;
            }

            ring += 1;
        }

        return layout;
    }

    renderMap();

    document.addEventListener("themechange", () => {
        refreshNodeColors();
        renderMap();
    });

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
        if (!map) return;
        map.style.transformOrigin = '0 0';
        map.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
    }

    const MIN_SCALE = 0.25;
    const MAX_SCALE = 3;

    function fitToView() {
        const rect = wrapper.getBoundingClientRect();

        if (!rect.width || !rect.height) {
            scale = 1;
            originX = 0;
            originY = 0;
            return;
        }

        const contentDiameter = (outerRadius + 120) * 2;
        const fitScale = Math.min(rect.width, rect.height) / contentDiameter;
        scale = Math.min(1, Math.max(MIN_SCALE, fitScale));
        originX = rect.width / 2 - centerX * scale;
        originY = rect.height / 2 - centerY * scale;
    }

    const COLLISION_SEARCH_ANGLE_OFFSETS = [0, 0.15, -0.15, 0.3, -0.3, 0.5, -0.5, 0.8, -0.8, 1.0, -1.0];

    function resolveSubtopicPosition(parentNode, initialAngle, initialRadius, halfW, halfH, obstacles, parentAngle) {
        const maxRadius = initialRadius + 40 * 20;
        let radius = initialRadius;

        while (radius <= maxRadius) {
            for (const offset of COLLISION_SEARCH_ANGLE_OFFSETS) {
                const angle = clampAngleToCone(initialAngle + offset, parentAngle, SUBTOPIC_CONE_HALF_ANGLE);
                const x = parentNode.x + Math.cos(angle) * radius;
                const y = parentNode.y + Math.sin(angle) * radius;
                if (!obstacles.some((o) => boxesOverlap({ x, y, halfW, halfH }, o))) {
                    return { x, y };
                }
            }
            radius += 20;
        }

        const fallbackAngle = clampAngleToCone(initialAngle, parentAngle, SUBTOPIC_CONE_HALF_ANGLE);
        return {
            x: parentNode.x + Math.cos(fallbackAngle) * radius,
            y: parentNode.y + Math.sin(fallbackAngle) * radius
        };
    }

    function renderMap() {
        const topicLineData = nodes.flatMap((start, i) => {
            return nodes.slice(i + 1).map((end, offset) => {
                const j = i + 1 + offset;
                const gradientId = `topic-line-${i}-${j}`;
                return {
                    gradient: `<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"><stop offset="0%" stop-color="${start.color}" /><stop offset="100%" stop-color="${end.color}" /></linearGradient>`,
                    line: `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" style="stroke: url(#${gradientId});" />`
                };
            });
        });
        const topicGradients = topicLineData.map((item) => item.gradient).join("");
        const topicLines = topicLineData.map((item) => item.line).join("");

        const obstacles = nodes.map((node) => ({
            x: node.x,
            y: node.y,
            halfW: nodeHalfWidth(node.label, 32),
            halfH: NODE_HALF_HEIGHT
        }));

        const expandedSubtopicData = [];
        const subtopicNodesByKey = new Map();

        Array.from(selectedTopicIndexes).forEach((topicIndex) => {
            const topic = topics[topicIndex];
            const parentNode = nodes[topicIndex] || { x: centerX, y: centerY, color: `hsl(0, 0%, ${getNeutralLightness()}%)` };
            const parentAngle = Math.atan2(parentNode.y - centerY, parentNode.x - centerX);
            const angled = getSubtopicAngles(parentNode, topic?.subtopics || []);

            angled.forEach(({ sub, angle, radius }) => {
                const halfW = nodeHalfWidth(sub.name, 36);
                const halfH = NODE_HALF_HEIGHT;
                const { x, y } = resolveSubtopicPosition(parentNode, angle, radius, halfW, halfH, obstacles, parentAngle);

                obstacles.push({ x, y, halfW, halfH });

                const subtopicIndex = topic.subtopics.indexOf(sub);
                const subtopicKey = `${topicIndex}-${subtopicIndex}`;
                const isExpanded = selectedSubtopicKeys.has(subtopicKey);
                subtopicNodesByKey.set(subtopicKey, {
                    x, y, color: parentNode.color, subtopic: sub,
                    topicSlug: slugify(topic.topic), subtopicSlug: slugify(sub.name)
                });

                expandedSubtopicData.push({
                    line: `<line x1="${parentNode.x}" y1="${parentNode.y}" x2="${x}" y2="${y}" style="stroke: ${parentNode.color};" />`,
                    markup: `<button type="button" class="network-node subtopic${isExpanded ? ' selected' : ''}" data-type="subtopic" data-topic-slug="${encodeURIComponent(slugify(topic.topic))}" data-subtopic-slug="${encodeURIComponent(slugify(sub.name))}" data-topic-index="${topicIndex}" data-subtopic-index="${subtopicIndex}" style="left: ${x}px; top: ${y}px; color: ${parentNode.color};">${escapeHtml(sub.name)}</button>`
                });
            });
        });

        const expandedUnitData = [];

        Array.from(selectedSubtopicKeys).forEach((key) => {
            const subtopicNode = subtopicNodesByKey.get(key);
            if (!subtopicNode) {
                return;
            }

            const parentAngle = Math.atan2(subtopicNode.y - centerY, subtopicNode.x - centerX);
            const angled = getSubtopicAngles(subtopicNode, subtopicNode.subtopic.units || []);

            angled.forEach(({ sub: unit, angle, radius }) => {
                const halfW = nodeHalfWidth(unit.name, 36);
                const halfH = NODE_HALF_HEIGHT;
                const { x, y } = resolveSubtopicPosition(subtopicNode, angle, radius, halfW, halfH, obstacles, parentAngle);

                obstacles.push({ x, y, halfW, halfH });

                expandedUnitData.push({
                    line: `<line x1="${subtopicNode.x}" y1="${subtopicNode.y}" x2="${x}" y2="${y}" style="stroke: ${subtopicNode.color};" />`,
                    markup: `<button type="button" class="network-node unit" data-type="unit" data-topic-slug="${encodeURIComponent(subtopicNode.topicSlug)}" data-subtopic-slug="${encodeURIComponent(subtopicNode.subtopicSlug)}" data-unit-slug="${encodeURIComponent(slugify(unit.name))}" style="left: ${x}px; top: ${y}px; color: ${subtopicNode.color};">${escapeHtml(unit.name)}</button>`
                });
            });
        });

        const lines = `${topicLines}${expandedSubtopicData.map((item) => item.line).join("")}${expandedUnitData.map((item) => item.line).join("")}`;

        const nodeMarkup = nodes.map((node, index) => `
            <button type="button" class="network-node topic${selectedTopicIndexes.has(index) ? ' selected' : ''}" data-type="topic" data-index="${index}" data-topic-slug="${encodeURIComponent(node.slug || '')}" style="left: ${node.x}px; top: ${node.y}px; color: ${node.color};">${escapeHtml(node.label)}</button>
        `).join("");

        const subtopicMarkup = expandedSubtopicData.map((item) => item.markup).join("");
        const unitMarkup = expandedUnitData.map((item) => item.markup).join("");

        map.innerHTML = `
            <svg class="network-lines" viewBox="0 0 1400 900" preserveAspectRatio="xMinYMin meet">
                <defs>${topicGradients}</defs>
                ${lines}
            </svg>
            ${nodeMarkup}
            ${subtopicMarkup}
            ${unitMarkup}
        `;
    }

    const activePointers = new Map();
    let pinchStartDistance = null;

    function getPinchMetrics() {
        const [a, b] = Array.from(activePointers.values());
        return {
            distance: Math.hypot(b.x - a.x, b.y - a.y),
            midX: (a.x + b.x) / 2,
            midY: (a.y + b.y) / 2
        };
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
        try {
            wrapper.setPointerCapture(event.pointerId);
        } catch (error) {
        }
        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (activePointers.size >= 2) {
            isDragging = false;
            hasDragged = true;
            pinchStartDistance = null;
            return;
        }

        isDragging = true;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        initialX = originX;
        initialY = originY;
    });

    wrapper.addEventListener("pointermove", (event) => {
        if (!activePointers.has(event.pointerId)) {
            return;
        }

        activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (activePointers.size >= 2) {
            event.preventDefault();
            const rect = wrapper.getBoundingClientRect();
            const { distance, midX, midY } = getPinchMetrics();
            const anchorX = midX - rect.left;
            const anchorY = midY - rect.top;

            if (pinchStartDistance) {
                const beforeX = (anchorX - originX) / scale;
                const beforeY = (anchorY - originY) / scale;
                scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * (distance / pinchStartDistance)));
                originX = anchorX - beforeX * scale;
                originY = anchorY - beforeY * scale;
                updateTransform();
            }

            pinchStartDistance = distance;
            return;
        }

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

    const releasePointer = (event) => {
        activePointers.delete(event.pointerId);
        pinchStartDistance = null;

        if (activePointers.size === 1) {
            const [remaining] = Array.from(activePointers.values());
            isDragging = true;
            dragStartX = remaining.x;
            dragStartY = remaining.y;
            initialX = originX;
            initialY = originY;
            return;
        }

        isDragging = false;
        setTimeout(() => {
            hasDragged = false;
        }, 0);
    };

    wrapper.addEventListener("pointerup", releasePointer);
    wrapper.addEventListener("pointerleave", releasePointer);
    wrapper.addEventListener("pointercancel", releasePointer);

    wrapper.addEventListener("selectstart", (event) => {
        if (isDragging) {
            event.preventDefault();
        }
    });

    resetButton?.addEventListener("click", () => {
        fitToView();
        updateTransform();
    });

    collapseButton?.addEventListener("click", () => {
        selectedTopicIndexes.clear();
        selectedSubtopicKeys.clear();
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
        const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomFactor));
        const scaleRatio = nextScale / scale;
        scale = nextScale;

        originX = pointerX - beforeX * scale;
        originY = pointerY - beforeY * scale;
        updateTransform();
    }, { passive: false });

    fitToView();
    updateTransform();
}

function renderMarkdownToolbar() {
    return `
        <div class="markdowntoolbar">
            <button class="markdownbutton" type="button" data-markdown="bold">Bold</button>
            <button class="markdownbutton" type="button" data-markdown="italic">Italic</button>
            <button class="markdownbutton" type="button" data-markdown="link">Link</button>
            <button class="markdownbutton" type="button" data-markdown="code">Code</button>
        </div>
    `;
}

function renderParenTags(tagarray) {
    return tagarray.map(tag => `<span class="tag">(${escapeHtml(tag)})</span>`).join(' ');
}

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
        const currentUser = await getCurrentUser();
        const response = await fetch(`/api/users/${encodeURIComponent(route.usernameSlug)}`);
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
                <div class="profiledetailpanel">
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
                                ${renderMarkdownToolbar()}
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
                                <input class="inputs resetinput" type="password" id="reset-new-password" autocomplete="new-password" placeholder="Enter your new password" minlength="8" required>
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

        if (bioInput) {
            autoResizeTextarea(bioInput);
            bioInput.addEventListener("input", () => autoResizeTextarea(bioInput));
        }

        if (profileSettingsForm && bioInput && publicEmailToggle) {
            profileSettingsForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                try {
                    const response = await fetch(`/api/users/${encodeURIComponent(route.usernameSlug)}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
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
                            username: route.usernameSlug,
                            code,
                            newPassword
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        resetStatus.textContent = data.message || "Password update failed.";
                        return;
                    }

                    window.location.href = "/login/";
                } catch (error) {
                    console.error("Failed to update password:", error);
                    resetStatus.textContent = "Password update failed.";
                }
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener("click", async () => {
                try {
                    await fetch("/api/logout", { method: "POST" });
                } catch (error) {
                    console.error("Logout request failed:", error);
                }
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

function updateSiteLogo(isDark) {
    const src = isDark ? "/images/dark-logo.png?v=3" : "/images/logo.png?v=3";
    document.querySelectorAll(".sitetitlelogo").forEach((img) => {
        img.src = src;
    });
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

        updateSiteLogo(isDark);
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
    updateSiteLogo(true);
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

async function updateUserCount() {
    try {
        const response = await fetch('/api/users/count');
        const data = await response.json();
        const userCountElement = document.getElementById('user-count');

        if (userCountElement && typeof data.count === 'number') {
            userCountElement.textContent = data.count.toLocaleString();
        }
    } catch (error) {
        console.error('Failed to fetch user count:', error);
    }
}

async function checkUserStatus() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        const firstTimeNotice = document.getElementById("firstTimeNotice");
        if (firstTimeNotice) {
            firstTimeNotice.classList.add("hidden");
        }

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

async function initSuggestionFormSelects(preselect = null) {
    const topicSelect = document.getElementById("suggest-topic");
    const subtopicSelect = document.getElementById("suggest-subtopic");
    const unitSelect = document.getElementById("suggest-unit");
    const tagsSelect = document.getElementById("suggest-tags");

    if (!topicSelect || !subtopicSelect || !unitSelect || !tagsSelect) {
        return;
    }

    let topics = [];

    try {
        const response = await fetch('/api/topics');
        topics = await response.json();
    } catch (error) {
        console.error('Failed to load topics for suggestion form:', error);
    }

    const populateUnits = (topicName, subtopicName, selectUnitName) => {
        const selectedTopic = topics.find((topic) => topic.topic === topicName);
        const selectedSubtopic = selectedTopic?.subtopics.find((subtopic) => subtopic.name === subtopicName);
        const units = selectedSubtopic ? (selectedSubtopic.units || []) : [];

        unitSelect.innerHTML = '<option value="">No specific unit</option>' +
            units.map((unit) => `<option value="${escapeHtml(unit.name)}">${escapeHtml(unit.name)}</option>`).join('');

        unitSelect.value = selectUnitName || "";
    };

    const populateSubtopics = (topicName, selectSubtopicName, selectUnitName) => {
        const selectedTopic = topics.find((topic) => topic.topic === topicName);
        const subtopics = selectedTopic ? selectedTopic.subtopics : [];

        subtopicSelect.innerHTML = subtopics.length
            ? subtopics.map((subtopic) => `<option value="${escapeHtml(subtopic.name)}">${escapeHtml(subtopic.name)}</option>`).join('')
            : '<option value="" disabled selected>No subtopics available</option>';

        if (selectSubtopicName) {
            subtopicSelect.value = selectSubtopicName;
        }

        populateUnits(topicName, subtopicSelect.value, selectUnitName);
    };

    topicSelect.innerHTML = topics.length
        ? '<option value="" disabled selected>Select a topic</option>' +
            topics.map((topic) => `<option value="${escapeHtml(topic.topic)}">${escapeHtml(topic.topic)}</option>`).join('')
        : '<option value="" disabled selected>No topics available</option>';

    topicSelect.addEventListener("change", () => populateSubtopics(topicSelect.value));
    subtopicSelect.addEventListener("change", () => populateUnits(topicSelect.value, subtopicSelect.value));

    try {
        const response = await fetch('/api/tags');
        const { tags } = await response.json();
        tagsSelect.innerHTML = (tags || []).map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
    } catch (error) {
        console.error('Failed to load tags for suggestion form:', error);
    }

    if (preselect) {
        if (preselect.topic) {
            topicSelect.value = preselect.topic;
            populateSubtopics(preselect.topic, preselect.subtopic, preselect.unit);
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

    const selectedTags = Array.from(document.getElementById("suggest-tags").selectedOptions)
        .map((option) => option.value);

    const payload = {
        name: document.getElementById("suggest-name").value.trim(),
        topic: document.getElementById("suggest-topic").value.trim(),
        subtopic: document.getElementById("suggest-subtopic").value.trim(),
        unit: document.getElementById("suggest-unit").value.trim(),
        tags: selectedTags.join(','),
        description: document.getElementById("suggest-description").value.trim(),
        problems: JSON.stringify(problems),
        calculatorAllowed: document.getElementById("suggest-calculator-allowed").checked,
        submitter: null
    };

    const currentUser = await getCurrentUser();
    if (currentUser) {
        payload.submitter = currentUser.username || null;
    }

    if (!payload.name || !payload.topic || !payload.subtopic || !problems.length) {
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
        const panel = document.querySelector(".aboutuspanel");
        if (subtext) {
            subtext.textContent = "You need to be logged in to contribute a problem set.";
        }
        if (panel) {
            panel.innerHTML = `<p class="topicdetailtext">Please <a class="footerlink" href="/login/">log in</a> to submit a problem set.</p>`;
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

        await initSuggestionFormSelects({ topic: suggestion.topic, subtopic: suggestion.subtopic, unit: suggestion.unit, tags: suggestion.tags });

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

function serializeProblemItems() {
    const items = Array.from(document.querySelectorAll('.problem-item'));
    return items.map((item) => {
        const prompt = item.querySelector('.problem-prompt').value.trim();
        const type = item.querySelector('.problem-type').value;

        if (type === 'multiple_choice') {
            const choiceRows = Array.from(item.querySelectorAll('.choice-row'));
            const choices = choiceRows.map(row => row.querySelector('.choice-input').value.trim()).filter(Boolean);
            const checkedRadio = item.querySelector('.choice-correct-radio:checked');
            const checkedRow = checkedRadio ? checkedRadio.closest('.choice-row') : null;
            const answer = checkedRow ? checkedRow.querySelector('.choice-input').value.trim() : '';

            return { prompt, type, choices, answer };
        }

        const answer = item.querySelector('.problem-answer').value.trim();
        return { prompt, type, choices: [], answer };
    }).filter(problem => problem.prompt && problem.type && problem.answer && (problem.type !== 'multiple_choice' || problem.choices.length > 0));
}

function removeProblemItem(button) {
    const item = button.closest('.problem-item');
    if (item) {
        item.remove();
    }
}

const CHOICE_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MIN_CHOICES = 2;
const MAX_CHOICES = CHOICE_LETTERS.length;
let problemItemCounter = 0;

function renumberChoices(item) {
    const rows = Array.from(item.querySelectorAll('.choice-row'));
    rows.forEach((row, index) => {
        const letter = CHOICE_LETTERS[index];
        const letterLabel = row.querySelector('.choice-letter-label');
        const input = row.querySelector('.choice-input');

        if (letterLabel) {
            letterLabel.textContent = `${letter}.`;
        }
        if (input) {
            input.placeholder = `Choice ${letter}`;
        }
    });
}

function createChoiceRow(groupName) {
    const row = document.createElement('div');
    row.className = 'choice-row';
    row.innerHTML = `
        <label class="choice-letter">
            <input type="radio" name="${groupName}" class="choice-correct-radio" title="Mark as the correct answer" required>
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

    const rows = choiceList.querySelectorAll('.choice-row');
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

    const rows = choiceList.querySelectorAll('.choice-row');
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
    const correctRadios = Array.from(item.querySelectorAll('.choice-correct-radio'));
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

let desmosToolEnabled = false;
let desmosApiKeyValue = null;
let desmosScriptPromise = null;

function loadDesmosScript(apiKey) {
    if (window.Desmos) {
        return Promise.resolve();
    }

    if (desmosScriptPromise) {
        return desmosScriptPromise;
    }

    desmosScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${encodeURIComponent(apiKey)}`;
        script.onload = () => {
            if (window.Desmos) {
                resolve();
            } else {
                reject(new Error("Desmos failed to initialize."));
            }
        };
        script.onerror = () => reject(new Error("Failed to load the Desmos script."));
        document.head.appendChild(script);
    });

    return desmosScriptPromise;
}

async function initDesmosTool() {
    try {
        const response = await fetch("/api/desmos-config");
        const data = await response.json();

        if (!response.ok || !data.enabled || !data.apiKey) {
            return;
        }

        desmosToolEnabled = true;
        desmosApiKeyValue = data.apiKey;
        document.querySelectorAll(".desmostoolbutton").forEach((button) => button.classList.remove("hidden"));

        document.addEventListener("click", (event) => {
            const button = event.target.closest(".desmostoolbutton");
            if (!button) {
                return;
            }

            const textarea = resolveDesmosTargetTextarea(button);
            if (textarea) {
                openDesmosModal(textarea);
            }
        });
    } catch (error) {
        console.error("Failed to load Desmos config:", error);
    }
}

function resolveDesmosTargetTextarea(button) {
    const targetId = button.dataset.desmosTarget;
    if (targetId) {
        return document.getElementById(targetId);
    }

    const item = button.closest(".problem-item");
    return item ? item.querySelector(".problem-prompt") : null;
}

function closeDesmosModal() {
    const existing = document.querySelector(".desmosmodaloverlay");
    if (existing) {
        existing.remove();
    }
}

function insertTextAtCursor(textarea, text) {
    if (!textarea) {
        return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + text + textarea.value.slice(end);
    textarea.focus();

    const cursor = start + text.length;
    textarea.setSelectionRange(cursor, cursor);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function openDesmosModal(targetTextarea) {
    closeDesmosModal();

    const overlay = document.createElement("div");
    overlay.className = "desmosmodaloverlay";
    overlay.innerHTML = `
        <div class="desmosmodal">
            <div class="desmosmodalheader">
                <div class="desmosmodaltabs">
                    <button type="button" class="desmosmodaltab desmosmodaltabactive" data-desmos-mode="graph">Graph</button>
                    <button type="button" class="desmosmodaltab" data-desmos-mode="geometry">Geometry</button>
                </div>
                <button type="button" class="desmosmodalclose" aria-label="Close">&times;</button>
            </div>
            <div class="desmosmodalcalculator" id="desmosCalculatorMount"></div>
            <div class="desmosmodalstatus" id="desmosModalStatus"></div>
            <div class="desmosmodalactions">
                <button type="button" class="authsubmit" id="desmosInsertButton">Insert into problem</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    let calculator = null;

    async function mountCalculator(mode) {
        const mount = document.getElementById("desmosCalculatorMount");
        const status = document.getElementById("desmosModalStatus");
        if (!mount) {
            return;
        }

        mount.innerHTML = "";
        if (status) {
            status.textContent = "Loading Desmos...";
        }

        if (calculator) {
            calculator.destroy();
            calculator = null;
        }

        try {
            await loadDesmosScript(desmosApiKeyValue);
        } catch (error) {
            console.error("Failed to load Desmos:", error);
            if (status) {
                status.textContent = "Unable to load Desmos right now.";
            }
            return;
        }

        try {
            calculator = mode === "geometry" && window.Desmos.GeometryCalculator
                ? window.Desmos.GeometryCalculator(mount)
                : window.Desmos.GraphingCalculator(mount);

            if (status) {
                status.textContent = "";
            }
        } catch (error) {
            console.error("Failed to start Desmos:", error);
            if (status) {
                status.textContent = "Unable to load Desmos right now.";
            }
        }
    }

    overlay.querySelectorAll(".desmosmodaltab").forEach((tab) => {
        tab.addEventListener("click", () => {
            overlay.querySelectorAll(".desmosmodaltab").forEach((otherTab) => otherTab.classList.remove("desmosmodaltabactive"));
            tab.classList.add("desmosmodaltabactive");
            mountCalculator(tab.dataset.desmosMode);
        });
    });

    overlay.querySelector(".desmosmodalclose").addEventListener("click", closeDesmosModal);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
            closeDesmosModal();
        }
    });

    document.getElementById("desmosInsertButton").addEventListener("click", () => {
        if (!calculator) {
            return;
        }

        const insertImage = (dataUri) => {
            if (!dataUri) {
                return;
            }
            insertTextAtCursor(targetTextarea, `\n![Desmos graph](${dataUri})\n`);
            closeDesmosModal();
        };

        if (typeof calculator.screenshot === "function") {
            insertImage(calculator.screenshot({ width: 600, height: 400 }));
        } else if (typeof calculator.asyncScreenshot === "function") {
            calculator.asyncScreenshot({ width: 600, height: 400 }, insertImage);
        }
    });

    mountCalculator("graph");
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
        <button class="markdownbutton desmostoolbutton${desmosToolEnabled ? '' : ' hidden'}" type="button">Insert Desmos graph</button>
        <label class="aboutustitle problem-choice-label">Answer Choices (select the correct one)</label>
        <div class="problem-choice-list" data-group-name="${groupName}"></div>
        <div class="choice-buttons">
            <button type="button" class="authsubmit add-choice-button">Add answer choice</button>
            <button type="button" class="authsubmit subtract-choice-button">Subtract answer choice</button>
        </div>
        <label class="aboutustitle problem-answer-label">Acceptable Answers</label>
        <input class="inputs problem-answer" type="text" placeholder="Enter acceptable answers separated by commas:">
    `;

    container.appendChild(template);

    const choiceList = template.querySelector('.problem-choice-list');
    for (let i = 0; i < 4; i += 1) {
        choiceList.appendChild(createChoiceRow(groupName));
    }
    renumberChoices(template);

    const removeButton = template.querySelector('.remove-problem-button');
    removeButton.addEventListener('click', () => removeProblemItem(removeButton));

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

    updateProblemItemTypeFields(template);
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

    if (problem.type === 'multiple_choice') {
        const choices = Array.isArray(problem.choices) ? problem.choices : [];

        while (template.querySelectorAll('.choice-row').length < choices.length) {
            addChoiceRow(template);
        }
        while (template.querySelectorAll('.choice-row').length > choices.length && template.querySelectorAll('.choice-row').length > MIN_CHOICES) {
            removeChoiceRow(template);
        }

        const rows = Array.from(template.querySelectorAll('.choice-row'));
        rows.forEach((row, index) => {
            const input = row.querySelector('.choice-input');
            const radio = row.querySelector('.choice-correct-radio');
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
    initMobileNav();

    const profileRoute = getProfileRoute();
    const isProblemsRoute = window.location.pathname.startsWith("/problems");

    if (profileRoute.view === "profile") {
        renderProfilePage();
    } else if (window.location.pathname.startsWith("/contribute")) {
        initContributePage();
    } else if (window.location.pathname.startsWith("/topics/network")) {
        renderTopicNetworkPage();
    } else if (isProblemsRoute) {
        initProblemSetSearch();
    } else {
        courseLoad();
        updateProblemSetCount();
        updateTopicCount();
        updateUserCount();
    }
    pingServer();
});
