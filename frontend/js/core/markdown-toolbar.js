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

function initMarkdownToolbar(toolbarSelector, textarea) {
    document.querySelectorAll(toolbarSelector).forEach((button) => {
        button.addEventListener("click", () => applyMarkdownToTextarea(textarea, button.dataset.markdown));
        button.addEventListener("dblclick", (event) => {
            event.preventDefault();
            applyMarkdownToTextarea(textarea, button.dataset.markdown, true);
        });
    });
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

export { insertMarkdownSnippet, applyMarkdownToTextarea, initMarkdownToolbar, renderMarkdownToolbar };
