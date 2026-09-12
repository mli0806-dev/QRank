import { initCorePage } from './core/page-init.js';

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

initCorePage();
updateProblemSetCount();
updateTopicCount();
updateUserCount();
