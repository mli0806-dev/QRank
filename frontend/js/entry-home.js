import { initCorePage } from './core/page-init.js';
import { getCurrentUser } from './core/auth-state.js';
import { renderProblemSetCard } from './problem-sets/search.js';

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

async function renderDashboard() {
    const container = document.getElementById('dashboard-in-progress');
    if (!container) {
        return;
    }

    try {
        const response = await fetch('/api/problem-sets/in-progress');
        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }
        const { problemSets } = await response.json();

        if (!problemSets.length) {
            container.innerHTML = '<p>No problem sets in progress. <a href="/problems/">Browse problems</a> to get started.</p>';
            return;
        }

        container.innerHTML = `
            <div class="problemsetlist">
                ${problemSets.map((problemSet) => renderProblemSetCard(problemSet, {
                    showBreadcrumb: true,
                    progressCorrect: problemSet.correctProblems,
                    progressTotal: problemSet.totalProblems
                })).join('')}
            </div>
        `;
    } catch (error) {
        console.error('Failed to load in-progress problem sets:', error);
        container.innerHTML = '<p>Unable to load in-progress problem sets right now.</p>';
    }
}

async function initHomePage() {
    const currentUser = await getCurrentUser();
    const intro = document.getElementById('home-intro');
    const dashboard = document.getElementById('home-dashboard');

    if (currentUser) {
        if (intro) {
            intro.classList.add('hidden');
        }
        if (dashboard) {
            dashboard.classList.remove('hidden');
        }

        const editProfileLink = document.getElementById('dashboard-edit-profile-link');
        if (editProfileLink) {
            editProfileLink.href = `/profile/${encodeURIComponent(currentUser.username)}`;
        }

        await renderDashboard();
    } else {
        updateProblemSetCount();
        updateCourseCount();
        updateUserCount();
    }
}

initCorePage();
initHomePage();
