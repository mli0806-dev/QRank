function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
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

function padTableDelimiters(text) {
    const lines = text.split("\n");
    const countCells = (line) => line.trim().replace(/^\||\|$/g, "").split("|").length;
    const isDelimiterRow = (line) => line.includes("|") && /^\s*\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?\s*$/.test(line);
    let inFence = false;

    for (let index = 0; index < lines.length; index += 1) {
        if (/^\s*(```|~~~)/.test(lines[index])) {
            inFence = !inFence;
            continue;
        }

        if (inFence || index === 0 || !isDelimiterRow(lines[index]) || !lines[index - 1].includes("|")) {
            continue;
        }

        const headerCells = countCells(lines[index - 1]);

        if (headerCells > countCells(lines[index])) {
            lines[index] = `| ${Array(headerCells).fill("---").join(" | ")} |`;
        }
    }

    return lines.join("\n");
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
    return DOMPurify.sanitize(marked.parse(padTableDelimiters(text), { breaks: true }));
}

function renderMathIn(element) {
    if (!element || typeof renderMathInElement === 'undefined') {
        return;
    }

    renderMathInElement(element, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "\\[", right: "\\]", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false
    });
}

function autoResizeTextarea(textarea) {
    if (!textarea) {
        return;
    }

    textarea.style.height = "0px";
    textarea.style.height = `${textarea.scrollHeight}px`;
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

export { slugify, escapeHtml, renderMarkdown, renderMathIn, autoResizeTextarea, insertTextAtCursor };
