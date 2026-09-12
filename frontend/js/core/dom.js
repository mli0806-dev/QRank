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

export { slugify, escapeHtml, renderMarkdown, renderMathIn, autoResizeTextarea };
