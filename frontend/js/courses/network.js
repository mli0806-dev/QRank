import { escapeHtml, slugify } from '../core/dom.js';

async function renderCourseNetworkPage() {
    const container = document.getElementById("coursecontainer");
    if (!container) {
        return;
    }

    container.innerHTML = `
        <div class="coursenetworkpage">
            <div class="network-map-wrapper" id="network-map-wrapper">
                <div class="network-map-controls">
                    <button type="button" id="network-exit-button" class="network-exit-button">Back to Courses</button>
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
            window.location.href = "/courses/";
        });
    }

    try {
        const apiUrl = (window.location.origin || '') + '/api/courses';
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const courses = await response.json();
        initCourseNetworkMap(courses);
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
                    renderCourseNetworkPage();
                });
            }
        }
    }
}

function initCourseNetworkMap(courses = []) {
    const wrapper = document.getElementById("network-map-wrapper");
    const map = document.getElementById("network-map");
    const resetButton = document.getElementById("network-reset-button");
    const collapseButton = document.getElementById("network-collapse-button");

    if (!wrapper || !map) {
        return;
    }

    const centerX = 700;
    const centerY = 450;
    const totalCourses = courses.length || 1;

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
    const TOPIC_CONE_HALF_ANGLE = Math.PI / 3;
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

    const courseLabels = courses.map((course) => course.course + (course.topics?.length ? ` (${course.topics.length})` : ''));

    const maxCourseHalfWidth = Math.max(70, ...courseLabels.map((label) => nodeHalfWidth(label, 32)));
    const angleStep = (Math.PI * 2) / totalCourses;
    const requiredRadius = totalCourses > 1
        ? (maxCourseHalfWidth * 2 + NODE_GAP) / (2 * Math.sin(angleStep / 2))
        : 0;
    const outerRadius = Math.max(320, requiredRadius);

    function getCourseLightness() {
        return document.body.classList.contains('dark') ? 80 : 40;
    }

    function getNeutralLightness() {
        return document.body.classList.contains('dark') ? 50 : 35;
    }

    const nodes = courses.map((course, index) => {
        const angle = (index / totalCourses) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * outerRadius;
        const y = centerY + Math.sin(angle) * outerRadius;
        const hue = (index / totalCourses) * 360;
        return { x, y, label: courseLabels[index], slug: slugify(course.course), hue, color: `hsl(${hue}, 50%, ${getCourseLightness()}%)` };
    });

    if (!nodes.length) {
        nodes.push({ x: centerX, y: centerY, label: 'No courses found', color: `hsl(0, 0%, ${getNeutralLightness()}%)` });
    }

    function refreshNodeColors() {
        const courseLightness = getCourseLightness();
        const neutralLightness = getNeutralLightness();
        nodes.forEach((node) => {
            node.color = typeof node.hue === 'number'
                ? `hsl(${node.hue}, 50%, ${courseLightness}%)`
                : `hsl(0, 0%, ${neutralLightness}%)`;
        });
    }

    const selectedCourseIndexes = new Set();
    const selectedTopicKeys = new Set();

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
        if (type === "course") {
            const index = Number(node.dataset.index);
            if (!Number.isNaN(index)) {
                if (selectedCourseIndexes.has(index)) {
                    selectedCourseIndexes.delete(index);
                } else {
                    selectedCourseIndexes.add(index);
                }
                renderMap();
            }
        } else if (type === "topic") {
            const courseIndex = Number(node.dataset.courseIndex);
            const topicIndex = Number(node.dataset.topicIndex);
            if (!Number.isNaN(courseIndex) && !Number.isNaN(topicIndex)) {
                const key = `${courseIndex}-${topicIndex}`;
                if (selectedTopicKeys.has(key)) {
                    selectedTopicKeys.delete(key);
                } else {
                    selectedTopicKeys.add(key);
                }
                renderMap();
            }
        } else if (type === "subtopic") {
            navigateToSubtopicNode(node);
        }
    };

    function navigateToSubtopicNode(node) {
        const courseSlug = node.dataset.courseSlug;
        const topicSlug = node.dataset.topicSlug;
        const subtopicSlug = node.dataset.subtopicSlug;
        if (courseSlug && topicSlug && subtopicSlug) {
            window.location.href = `/courses/${courseSlug}/${topicSlug}/${subtopicSlug}`;
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
        if (type === "course") {
            const courseSlug = node.dataset.courseSlug;
            if (courseSlug) {
                window.location.href = `/courses/${courseSlug}`;
            }
        } else if (type === "topic") {
            const courseSlug = node.dataset.courseSlug;
            const topicSlug = node.dataset.topicSlug;
            if (courseSlug && topicSlug) {
                window.location.href = `/courses/${courseSlug}/${topicSlug}`;
            }
        } else if (type === "subtopic") {
            navigateToSubtopicNode(node);
        }
    });

    function getTopicAngles(parentNode, topics) {
        const baseRadius = 200;
        const ringGap = 150;
        const maxRingArc = TOPIC_CONE_HALF_ANGLE * 2;
        const nodeHorizontalPadding = 36;
        const parentAngle = Math.atan2(parentNode.y - centerY, parentNode.x - centerX);
        const layout = [];
        let remaining = topics.slice();
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

    function resolveTopicPosition(parentNode, initialAngle, initialRadius, halfW, halfH, obstacles, parentAngle) {
        const maxRadius = initialRadius + 40 * 20;
        let radius = initialRadius;

        while (radius <= maxRadius) {
            for (const offset of COLLISION_SEARCH_ANGLE_OFFSETS) {
                const angle = clampAngleToCone(initialAngle + offset, parentAngle, TOPIC_CONE_HALF_ANGLE);
                const x = parentNode.x + Math.cos(angle) * radius;
                const y = parentNode.y + Math.sin(angle) * radius;
                if (!obstacles.some((o) => boxesOverlap({ x, y, halfW, halfH }, o))) {
                    return { x, y };
                }
            }
            radius += 20;
        }

        const fallbackAngle = clampAngleToCone(initialAngle, parentAngle, TOPIC_CONE_HALF_ANGLE);
        return {
            x: parentNode.x + Math.cos(fallbackAngle) * radius,
            y: parentNode.y + Math.sin(fallbackAngle) * radius
        };
    }

    function renderMap() {
        const courseLineData = nodes.flatMap((start, i) => {
            return nodes.slice(i + 1).map((end, offset) => {
                const j = i + 1 + offset;
                const gradientId = `course-line-${i}-${j}`;
                return {
                    gradient: `<linearGradient id="${gradientId}" gradientUnits="userSpaceOnUse" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"><stop offset="0%" stop-color="${start.color}" /><stop offset="100%" stop-color="${end.color}" /></linearGradient>`,
                    line: `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" style="stroke: url(#${gradientId});" />`
                };
            });
        });
        const courseGradients = courseLineData.map((item) => item.gradient).join("");
        const courseLines = courseLineData.map((item) => item.line).join("");

        const obstacles = nodes.map((node) => ({
            x: node.x,
            y: node.y,
            halfW: nodeHalfWidth(node.label, 32),
            halfH: NODE_HALF_HEIGHT
        }));

        const expandedTopicData = [];
        const topicNodesByKey = new Map();

        Array.from(selectedCourseIndexes).forEach((courseIndex) => {
            const course = courses[courseIndex];
            const parentNode = nodes[courseIndex] || { x: centerX, y: centerY, color: `hsl(0, 0%, ${getNeutralLightness()}%)` };
            const parentAngle = Math.atan2(parentNode.y - centerY, parentNode.x - centerX);
            const angled = getTopicAngles(parentNode, course?.topics || []);

            angled.forEach(({ sub, angle, radius }) => {
                const halfW = nodeHalfWidth(sub.name, 36);
                const halfH = NODE_HALF_HEIGHT;
                const { x, y } = resolveTopicPosition(parentNode, angle, radius, halfW, halfH, obstacles, parentAngle);

                obstacles.push({ x, y, halfW, halfH });

                const topicIndex = course.topics.indexOf(sub);
                const topicKey = `${courseIndex}-${topicIndex}`;
                const isExpanded = selectedTopicKeys.has(topicKey);
                topicNodesByKey.set(topicKey, {
                    x, y, color: parentNode.color, topic: sub,
                    courseSlug: slugify(course.course), topicSlug: slugify(sub.name)
                });

                expandedTopicData.push({
                    line: `<line x1="${parentNode.x}" y1="${parentNode.y}" x2="${x}" y2="${y}" style="stroke: ${parentNode.color};" />`,
                    markup: `<button type="button" class="network-node topic${isExpanded ? ' selected' : ''}" data-type="topic" data-course-slug="${encodeURIComponent(slugify(course.course))}" data-topic-slug="${encodeURIComponent(slugify(sub.name))}" data-course-index="${courseIndex}" data-topic-index="${topicIndex}" style="left: ${x}px; top: ${y}px; color: ${parentNode.color};">${escapeHtml(sub.name)}</button>`
                });
            });
        });

        const expandedSubtopicData = [];

        Array.from(selectedTopicKeys).forEach((key) => {
            const topicNode = topicNodesByKey.get(key);
            if (!topicNode) {
                return;
            }

            const parentAngle = Math.atan2(topicNode.y - centerY, topicNode.x - centerX);
            const angled = getTopicAngles(topicNode, topicNode.topic.subtopics || []);

            angled.forEach(({ sub: subtopic, angle, radius }) => {
                const halfW = nodeHalfWidth(subtopic.name, 36);
                const halfH = NODE_HALF_HEIGHT;
                const { x, y } = resolveTopicPosition(topicNode, angle, radius, halfW, halfH, obstacles, parentAngle);

                obstacles.push({ x, y, halfW, halfH });

                expandedSubtopicData.push({
                    line: `<line x1="${topicNode.x}" y1="${topicNode.y}" x2="${x}" y2="${y}" style="stroke: ${topicNode.color};" />`,
                    markup: `<button type="button" class="network-node subtopic" data-type="subtopic" data-course-slug="${encodeURIComponent(topicNode.courseSlug)}" data-topic-slug="${encodeURIComponent(topicNode.topicSlug)}" data-subtopic-slug="${encodeURIComponent(slugify(subtopic.name))}" style="left: ${x}px; top: ${y}px; color: ${topicNode.color};">${escapeHtml(subtopic.name)}</button>`
                });
            });
        });

        const lines = `${courseLines}${expandedTopicData.map((item) => item.line).join("")}${expandedSubtopicData.map((item) => item.line).join("")}`;

        const nodeMarkup = nodes.map((node, index) => `
            <button type="button" class="network-node course${selectedCourseIndexes.has(index) ? ' selected' : ''}" data-type="course" data-index="${index}" data-course-slug="${encodeURIComponent(node.slug || '')}" style="left: ${node.x}px; top: ${node.y}px; color: ${node.color};">${escapeHtml(node.label)}</button>
        `).join("");

        const topicMarkup = expandedTopicData.map((item) => item.markup).join("");
        const subtopicMarkup = expandedSubtopicData.map((item) => item.markup).join("");

        map.innerHTML = `
            <svg class="network-lines" viewBox="0 0 1400 900" preserveAspectRatio="xMinYMin meet">
                <defs>${courseGradients}</defs>
                ${lines}
            </svg>
            ${nodeMarkup}
            ${topicMarkup}
            ${subtopicMarkup}
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
        selectedCourseIndexes.clear();
        selectedTopicKeys.clear();
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
        scale = nextScale;

        originX = pointerX - beforeX * scale;
        originY = pointerY - beforeY * scale;
        updateTransform();
    }, { passive: false });

    fitToView();
    updateTransform();
}

export { renderCourseNetworkPage };
