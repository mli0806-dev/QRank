const EYE_OPEN = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M1.8 12s3.8-6.8 10.2-6.8S22.2 12 22.2 12s-3.8 6.8-10.2 6.8S1.8 12 1.8 12Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    </svg>
`;

const EYE_CLOSED = `
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
        <path d="M1.8 12s3.8-6.8 10.2-6.8S22.2 12 22.2 12s-3.8 6.8-10.2 6.8S1.8 12 1.8 12Z"></path>
        <circle cx="12" cy="12" r="3"></circle>
        <line x1="3.5" y1="3.5" x2="20.5" y2="20.5"></line>
    </svg>
`;

function setVisible(input, button, visible) {
    const start = input.selectionStart;
    const end = input.selectionEnd;

    input.type = visible ? 'text' : 'password';
    button.innerHTML = visible ? EYE_CLOSED : EYE_OPEN;
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(visible));

    if (document.activeElement === input && start !== null) {
        input.setSelectionRange(start, end);
    }
}

function decorate(input) {
    if (input.dataset.passwordToggle === 'on') {
        return;
    }

    input.dataset.passwordToggle = 'on';

    const field = document.createElement('div');
    field.className = 'passwordfield';
    input.parentNode.insertBefore(field, input);
    field.appendChild(input);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'passwordtoggle';
    field.appendChild(button);

    setVisible(input, button, false);

    button.addEventListener('click', () => {
        setVisible(input, button, input.type === 'password');
        input.focus();
    });
}

function initPasswordToggles(root = document) {
    if (!root) {
        return;
    }

    root.querySelectorAll('input[type="password"]').forEach(decorate);
}

export { initPasswordToggles };
