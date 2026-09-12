import { escapeHtml } from '../core/dom.js';

function renderChoiceInputs(problem, options = {}) {
    const { interactive = false, namePrefix = null, markCorrect = false } = options;
    const choices = Array.isArray(problem.choices) ? problem.choices : [];

    return choices.map((choice, index) => {
        const nameAttr = interactive && namePrefix ? `name="${namePrefix}"` : '';
        const valueAttr = interactive ? `value="${escapeHtml(choice)}"` : '';
        const disabledAttr = interactive ? '' : 'disabled';
        const checkedAttr = markCorrect && choice && choice === problem.answer ? 'checked' : '';

        return `
            <label class="problemtakechoice">
                <input type="radio" ${nameAttr} ${valueAttr} class="problemtakechoiceinput" ${disabledAttr} ${checkedAttr}>
                <span class="problemtakechoiceletter">${String.fromCharCode(65 + index)}</span>
                <span class="problemtakechoicetext">${escapeHtml(choice)}</span>
            </label>
        `;
    }).join('');
}

export { renderChoiceInputs };
