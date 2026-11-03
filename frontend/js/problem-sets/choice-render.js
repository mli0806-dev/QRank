import { escapeHtml } from '../core/dom.js';

function renderChoiceInputs(problem, options = {}) {
    const { interactive = false, namePrefix = null, markCorrect = false, selectedValue = null, eliminable = false } = options;
    const choices = Array.isArray(problem.choices) ? problem.choices : [];

    return choices.map((choice, index) => {
        const nameAttr = interactive && namePrefix ? `name="${namePrefix}"` : '';
        const valueAttr = interactive ? `value="${escapeHtml(choice)}"` : '';
        const disabledAttr = interactive ? '' : 'disabled';
        const isMarkedCorrect = markCorrect && choice && choice === problem.answer;
        const isSelected = selectedValue !== null && choice === selectedValue;
        const checkedAttr = isMarkedCorrect || isSelected ? 'checked' : '';

        const letter = String.fromCharCode(65 + index);
        const eliminateHtml = eliminable
            ? `<button type="button" class="problemtakeeliminate" aria-pressed="false" aria-label="Eliminate choice ${letter}" title="Eliminate choice ${letter}">&times;</button>`
            : '';

        return `
            <label class="problemtakechoice">
                <input type="radio" ${nameAttr} ${valueAttr} class="problemtakechoiceinput" ${disabledAttr} ${checkedAttr}>
                <span class="problemtakechoiceletter">${letter}</span>
                <span class="problemtakechoicetext">${escapeHtml(choice)}</span>
                ${eliminateHtml}
            </label>
        `;
    }).join('');
}

export { renderChoiceInputs };
