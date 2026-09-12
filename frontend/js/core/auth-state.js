import { escapeHtml } from './dom.js';

let currentUserPromise = null;

function getCurrentUser() {
    if (!currentUserPromise) {
        currentUserPromise = fetch("/api/auth/me")
            .then(response => (response.ok ? response.json() : null))
            .then(data => data?.user || null)
            .catch(() => null);
    }

    return currentUserPromise;
}

async function checkUserStatus() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        const firstTimeNotice = document.getElementById("firstTimeNotice");
        if (firstTimeNotice) {
            firstTimeNotice.classList.add("hidden");
        }

        const loginLinks = document.querySelectorAll("a[href='/login/']");

        loginLinks.forEach((link) => {
            const listItem = link.parentElement;
            const displayName = escapeHtml(user.username || "Profile");

            if (listItem && listItem.parentElement && listItem.parentElement.classList.contains("tablist")) {
                listItem.innerHTML = `
                    <a class="profilemenulink" href="/profile/${encodeURIComponent(user.username)}">${displayName}</a>
                `;
                return;
            }

            link.textContent = displayName;
            link.href = `/profile/${encodeURIComponent(user.username)}`;
            link.classList.remove("login");
            link.classList.add("profilemenulink");
        });
    } catch (error) {
        console.error("Error checking user status:", error);
    }
}

export { getCurrentUser, checkUserStatus };
