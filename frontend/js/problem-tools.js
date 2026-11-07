import { getDesmosConfig, loadDesmosScript } from './desmos-render.js';

let panel = null;
let calculatorReady = null;
let graphingEnabled = false;
const calculators = {};
const DEFAULT_GRAPH_BOUNDS = { left: -10, right: 10, bottom: -10, top: 10 };

function buildPanel() {
    const element = document.createElement('div');
    element.className = graphingEnabled ? 'calculatorpanel calculatorpanelwide hidden' : 'calculatorpanel hidden';
    element.innerHTML = `
        <div class="calculatorpanelheader">
            <span class="calculatorpaneltitle">Calculator</span>
            <button type="button" class="calculatorpanelclose" aria-label="Close calculator">&times;</button>
        </div>
        ${graphingEnabled ? `
            <div class="calculatortabs" role="tablist">
                <button type="button" class="calculatortab calculatortabactive" data-calculator="scientific" aria-selected="true">Scientific</button>
                <button type="button" class="calculatortab" data-calculator="graphing" aria-selected="false">Graphing</button>
            </div>
        ` : ''}
        <div class="calculatorpanelmount" data-calculator-mount="scientific"></div>
        ${graphingEnabled ? '<div class="calculatorpanelmount hidden" data-calculator-mount="graphing"></div>' : ''}
    `;
    document.body.appendChild(element);
    element.querySelector('.calculatorpanelclose').addEventListener('click', () => setCalculatorOpen(false));
    makeDraggable(element, element.querySelector('.calculatorpanelheader'));

    element.querySelectorAll('.calculatortab').forEach((tab) => {
        tab.addEventListener('click', () => showCalculator(tab.dataset.calculator));
    });

    return element;
}

function showCalculator(name) {
    if (!panel) {
        return;
    }

    panel.querySelectorAll('.calculatortab').forEach((tab) => {
        const active = tab.dataset.calculator === name;
        tab.classList.toggle('calculatortabactive', active);
        tab.setAttribute('aria-selected', String(active));
    });

    panel.querySelectorAll('[data-calculator-mount]').forEach((mount) => {
        mount.classList.toggle('hidden', mount.dataset.calculatorMount !== name);
    });

    if (calculators[name]) {
        calculators[name].resize();
    }
}

function makeDraggable(element, handle) {
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let dragging = false;

    handle.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.calculatorpanelclose')) {
            return;
        }

        const rect = element.getBoundingClientRect();

        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.top}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';

        startX = event.clientX;
        startY = event.clientY;
        originLeft = rect.left;
        originTop = rect.top;
        dragging = true;
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
    });

    handle.addEventListener('pointermove', (event) => {
        if (!dragging) {
            return;
        }

        const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - element.offsetHeight);

        element.style.left = `${Math.min(Math.max(0, originLeft + event.clientX - startX), maxLeft)}px`;
        element.style.top = `${Math.min(Math.max(0, originTop + event.clientY - startY), maxTop)}px`;
    });

    const endDrag = (event) => {
        if (!dragging) {
            return;
        }

        dragging = false;

        if (handle.hasPointerCapture(event.pointerId)) {
            handle.releasePointerCapture(event.pointerId);
        }
    };

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
}

function setCalculatorOpen(open) {
    if (!panel) {
        return;
    }

    panel.classList.toggle('hidden', !open);
    document.querySelectorAll('[data-tool="calculator"]').forEach((button) => {
        button.classList.toggle('problemtaketoolactive', open);
        button.setAttribute('aria-pressed', String(open));
    });
}

async function ensureCalculator() {
    if (calculatorReady) {
        return calculatorReady;
    }

    calculatorReady = (async () => {
        const config = await getDesmosConfig();

        if (!config) {
            return false;
        }

        await loadDesmosScript(config.apiKey);
        panel = panel || buildPanel();
        calculators.scientific = window.Desmos.ScientificCalculator(panel.querySelector('[data-calculator-mount="scientific"]'));

        if (graphingEnabled) {
            calculators.graphing = window.Desmos.GraphingCalculator(panel.querySelector('[data-calculator-mount="graphing"]'));
            calculators.graphing.setMathBounds(DEFAULT_GRAPH_BOUNDS);
        }

        return true;
    })();

    return calculatorReady;
}

function createMark() {
    const mark = document.createElement('mark');
    mark.className = 'problemhighlight';
    return mark;
}

function splitRangeBoundaries(range) {
    const { endContainer, endOffset } = range;

    if (endContainer.nodeType === Node.TEXT_NODE && endOffset > 0 && endOffset < endContainer.nodeValue.length) {
        endContainer.splitText(endOffset);
    }

    const { startContainer, startOffset } = range;

    if (startContainer.nodeType === Node.TEXT_NODE && startOffset > 0 && startOffset < startContainer.nodeValue.length) {
        range.setStart(startContainer.splitText(startOffset), 0);
    }
}

function textNodesInRange(container, range) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node = walker.nextNode();

    while (node) {
        if (range.intersectsNode(node)) {
            nodes.push(node);
        }
        node = walker.nextNode();
    }

    return nodes;
}

function markFor(node) {
    const parent = node.parentElement;
    return parent && parent.closest('.problemhighlight');
}

function wrapTextNode(node) {
    const mark = createMark();
    node.parentNode.insertBefore(mark, node);
    mark.appendChild(node);
}

function unwrapTextNode(node) {
    const mark = markFor(node);

    if (!mark) {
        return;
    }

    const parent = mark.parentNode;
    const before = [];
    const after = [];
    let passed = false;

    Array.from(mark.childNodes).forEach((child) => {
        if (child === node) {
            passed = true;
            return;
        }

        (passed ? after : before).push(child);
    });

    const rewrap = (children) => {
        const replacement = createMark();
        children.forEach((child) => replacement.appendChild(child));
        parent.insertBefore(replacement, mark);
    };

    if (before.length) {
        rewrap(before);
    }

    parent.insertBefore(node, mark);

    if (after.length) {
        rewrap(after);
    }

    mark.remove();
}

function toggleHighlight(container) {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
    }

    const range = selection.getRangeAt(0);

    if (!container.contains(range.commonAncestorContainer)) {
        return;
    }

    splitRangeBoundaries(range);

    const nodes = textNodesInRange(container, range);
    const highlighted = nodes.filter(markFor);

    if (highlighted.length) {
        highlighted.forEach(unwrapTextNode);
    } else {
        nodes.filter((node) => node.nodeValue.trim() !== '').forEach(wrapTextNode);
    }

    container.normalize();
    selection.removeAllRanges();
}

function initHighlightTool(form) {
    const button = form.querySelector('[data-tool="highlight"]');
    const prompt = form.querySelector('.problemtakeprompt');

    if (!button || !prompt) {
        return;
    }

    let active = false;

    button.addEventListener('click', () => {
        active = !active;
        button.classList.toggle('problemtaketoolactive', active);
        button.setAttribute('aria-pressed', String(active));
        prompt.classList.toggle('problemhighlighting', active);
    });

    prompt.addEventListener('mouseup', () => {
        if (active) {
            toggleHighlight(prompt);
        }
    });
}

function initProblemTools(form, options = {}) {
    const calculatorButton = form.querySelector('[data-tool="calculator"]');

    if (options.graphingAllowed) {
        graphingEnabled = true;
    }

    if (calculatorButton) {
        getDesmosConfig().then((config) => {
            if (config) {
                calculatorButton.classList.remove('hidden');
            }
        });

        calculatorButton.addEventListener('click', async () => {
            const ready = await ensureCalculator();

            if (ready) {
                const opening = panel.classList.contains('hidden');
                setCalculatorOpen(opening);

                if (opening) {
                    Object.values(calculators).forEach((calculator) => calculator.resize());
                }
            }
        });
    }

    initHighlightTool(form);
}

export { initProblemTools };
