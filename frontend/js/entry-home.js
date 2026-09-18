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

async function updateCourseCount() {
    try {
        const response = await fetch('/api/courses/count');
        const data = await response.json();
        const coursesLink = document.querySelector('#courses-count-link .boxtitle');

        if (coursesLink && typeof data.count === 'number') {
            coursesLink.textContent = `${data.count} Course${data.count === 1 ? '' : 's'}`;
        }
    } catch (error) {
        console.error('Failed to fetch course count:', error);
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
updateCourseCount();
updateUserCount();
