import { escapeHtml } from './dom.js';

function renderRankBadge(rank) {
    if (!rank || !rank.key) {
        return '';
    }

    const key = escapeHtml(rank.key);
    const label = escapeHtml(rank.label);

    return `<img class="rankbadge" src="/images/ranks/${key}.png?v=2" alt="${label}" title="${label}" width="20" height="20">`;
}

export { renderRankBadge };
