function toggleDropdown(button) {
    const dropdown = button.parentElement.nextElementSibling

    const isopen = dropdown.classList.toggle("show");
    button.classList.toggle("open", isopen);
}

function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getTopicRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    const params = new URLSearchParams(window.location.search);
    const topicParam = params.get("topic");
    const subtopicParam = params.get("subtopic");

    if (parts[0] === "topics") {
        if (parts.length >= 3) {
            return {
                view: "subtopic",
                topicSlug: parts[1],
                subtopicSlug: parts[2]
            };
        }

        if (parts.length >= 2) {
            return {
                view: "topic",
                topicSlug: parts[1]
            };
        }

        return { view: "index" };
    }

    if (topicParam && subtopicParam) {
        return {
            view: "subtopic",
            topicSlug: topicParam,
            subtopicSlug: subtopicParam
        };
    }

    if (topicParam) {
        return {
            view: "topic",
            topicSlug: topicParam
        };
    }

    return { view: "index" };
}

function getProfileRoute() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);

    if (parts[0] === "profile" && parts.length >= 2) {
        return {
            view: "profile",
            usernameSlug: parts[1]
        };
    }

    return { view: "none" };
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderMarkdown(value) {
    const escaped = escapeHtml(value || "");
    const withBreaks = escaped.replace(/\n/g, "<br>");
    const withParagraphs = withBreaks
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>")
        .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    return withParagraphs || "No bio yet.";
}

function insertMarkdownSnippet(textarea, prefix, suffix, placeholder) {
    if (!textarea) {
        return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end) || placeholder;
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newValue = textarea.value.slice(0, start) + replacement + textarea.value.slice(end);

    textarea.value = newValue;
    textarea.focus();

    const cursorStart = start + prefix.length;
    const cursorEnd = cursorStart + selectedText.length;
    textarea.setSelectionRange(cursorStart, cursorEnd);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function applyMarkdownToBio(action) {
    const textarea = document.getElementById("bioInput");

    if (!textarea) {
        return;
    }

    switch (action) {
        case "bold":
            insertMarkdownSnippet(textarea, "**", "**", "bold text");
            break;
        case "italic":
            insertMarkdownSnippet(textarea, "*", "*", "italic text");
            break;
        case "link":
            insertMarkdownSnippet(textarea, "[", "](https://example.com)", "link text");
            break;
        case "code":
            insertMarkdownSnippet(textarea, "`", "`", "code");
            break;
        default:
            break;
    }
}

function renderTopicIndex(topics) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    container.innerHTML = topics.map(topic => {
        const subtopicshtml = topic.subtopics.map(subtopic => {
            const tagarray = subtopic.tags ? subtopic.tags.split(', ') : [];
            const tagshtml = tagarray.map(tag => `
                    <span class="tag">(${tag})</span>
                `).join(' ');

            return `
                <a href="/topics/${encodeURIComponent(slugify(topic.topic))}/${encodeURIComponent(slugify(subtopic.name))}">
                    ${subtopic.name} ${tagshtml}
                </a>
            `;
        }).join(' ');

        return `
            <div class="topicboxes">
                <div class="topicheader">
                    <h3 class="topictitle">
                        <a class="topictitlelink" href="/topics/${encodeURIComponent(slugify(topic.topic))}">
                            ${topic.topic}
                        </a>
                    </h3>
                    <button class="dropdownbutton" onclick="toggleDropdown(this)">⌄</button>
                </div>
                <div class="dropdowncontent">
                    ${subtopicshtml || '<a href="#">No subtopics available</a>'}
                </div>
            </div>
        `;
    }).join(' ');
}

function renderTopicDetail(topics, topicSlug) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    const selectedTopic = topics.find(topic => slugify(topic.topic) === topicSlug);

    if (!selectedTopic) {
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Topic not found</h1>
                <p class="topicdetailtext">We couldn't find that topic. Go back to the <a href="/topics/">topic gallery</a> and try another one.</p>
            </div>
        `;
        return;
    }

    const subtopicshtml = selectedTopic.subtopics.length
        ? selectedTopic.subtopics.map(subtopic => {
            const tagarray = subtopic.tags ? subtopic.tags.split(', ') : [];
            const tagshtml = tagarray.map(tag => `<span class="tag">(${tag})</span>`).join(' ');

            return `
                <a class="topicdetailitem" id="${slugify(subtopic.name)}" href="/topics/${encodeURIComponent(topicSlug)}/${encodeURIComponent(slugify(subtopic.name))}">
                    <span class="topicdetailitemtitle">${subtopic.name}</span>
                    <span class="topicdetailitemmeta">${tagshtml}</span>
                </a>
            `;
        }).join('')
        : '<p class="topicdetailtext">No subtopics available yet.</p>';

    container.innerHTML = `
        <div class="topicdetail">
            <a class="topicdetailback" href="/topics/">Back to all topics</a>
            <h1 class="topicdetailtitle">${selectedTopic.topic}</h1>
            <div class="topicdetailgrid">
                ${subtopicshtml}
            </div>
        </div>
    `;
}

function renderSubtopicDetail(topics, topicSlug, subtopicSlug) {
    const container = document.getElementById("coursecontainer");

    if (!container) {
        return;
    }

    const selectedTopic = topics.find(topic => slugify(topic.topic) === topicSlug);

    if (!selectedTopic) {
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Topic not found</h1>
                <p class="topicdetailtext">We couldn't find that topic. Go back to the <a href="/topics/">topic gallery</a> and try another one.</p>
            </div>
        `;
        return;
    }

    const selectedSubtopic = selectedTopic.subtopics.find(subtopic => slugify(subtopic.name) === subtopicSlug);

    if (!selectedSubtopic) {
        container.innerHTML = `
            <div class="topicdetail">
                <a class="topicdetailback" href="/topics/${encodeURIComponent(topicSlug)}">Back to ${selectedTopic.topic}</a>
                <h1 class="topicdetailtitle">Subtopic not found</h1>
                <p class="topicdetailtext">We couldn't find that subtopic inside this topic.</p>
            </div>
        `;
        return;
    }

    const tagarray = selectedSubtopic.tags ? selectedSubtopic.tags.split(', ') : [];
    const tagshtml = tagarray.map(tag => `<span class="tag">(${tag})</span>`).join(' ');

    container.innerHTML = `
        <div class="topicdetail">
            <a class="topicdetailback" href="/topics/${encodeURIComponent(topicSlug)}">Back to ${selectedTopic.topic}</a>
            <p class="topicdetaileyebrow">${selectedTopic.topic}</p>
            <h1 class="topicdetailtitle">${selectedSubtopic.name}</h1>
            <p class="topicdetailtext">${tagshtml}</p>
            <div class="topicdetailpanel">
                <p class="topicdetailtext">This is the dynamic page for the selected subtopic. You can expand this view later with problem sets, explanations, or progress tracking.</p>
            </div>
        </div>
    `;
}

async function renderProfilePage() {
    const container = document.getElementById("profilecontainer");

    if (!container) {
        return;
    }

    const route = getProfileRoute();

    if (route.view !== "profile") {
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Profile not found</h1>
                <p class="topicdetailtext">This profile page could not be loaded.</p>
            </div>
        `;
        return;
    }

    try {
        const currentUserRaw = localStorage.getItem("currentUser");
        let currentUser = null;

        if (currentUserRaw) {
            try {
                currentUser = JSON.parse(currentUserRaw);
            } catch (error) {
                currentUser = null;
            }
        }

        const viewerUsername = currentUser?.username || null;
        const response = await fetch(`/api/users/${encodeURIComponent(route.usernameSlug)}${viewerUsername ? `?viewerUsername=${encodeURIComponent(viewerUsername)}` : ""}`);
        const data = await response.json();

        if (!response.ok) {
            container.innerHTML = `
                <div class="topicdetail">
                    <h1 class="topicdetailtitle">Profile not found</h1>
                </div>
            `;
            return;
        }

        const user = data.user;

        const isOwnProfile = currentUser && currentUser.username === user.username;
        const showEmail = isOwnProfile || user.publicEmail;
        const bioText = renderMarkdown(user.bio || "");

        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">${escapeHtml(user.username)}</h1>
                <div class="topicdetailpanel">
                    <p class="topicdetailtext"><span>User ID:</span> ${escapeHtml(user.id)}</p>
                    ${showEmail ? `<p class="topicdetailtext"><span>Email:</span> ${escapeHtml(user.email || "No email on file.")}</p>` : ""}
                    <p class="topicdetailtext"><span>Bio:</span></p>
                    <div class="profilebiooutput">${bioText}</div>
                </div>
                ${isOwnProfile ? `
                    <div class="profileactions">
                        <div class="profilecard">
                            <span class="profilesectiontitle">Edit public profile</span>
                            <form id="profileSettingsForm" class="profileform">
                                <label class="profilefieldlabel" for="bioInput">Bio</label>
                                <div class="markdowntoolbar">
                                    <button class="markdownbutton" type="button" data-markdown="bold">Bold</button>
                                    <button class="markdownbutton" type="button" data-markdown="italic">Italic</button>
                                    <button class="markdownbutton" type="button" data-markdown="link">Link</button>
                                    <button class="markdownbutton" type="button" data-markdown="code">Code</button>
                                </div>
                                <textarea id="bioInput" class="inputs profilebio" maxlength="1000" rows="8" placeholder="Tell people about yourself">${escapeHtml(user.bio || "")}</textarea>
                                <label class="profiletoggle">
                                    <input type="checkbox" id="publicEmailToggle" ${user.publicEmail ? "checked" : ""}>
                                    <span>Make my email public</span>
                                </label>
                                <button class="authsubmit" type="submit">Save profile</button>
                            </form>
                        </div>
                        <button id="openResetButton" class="resetbutton" type="button">Change Password</button>
                        <div id="resetPanel" class="resetpanel hidden">
                            <p class="topicdetailtext">We will send a verification code to the email linked to your account. It will expire in 15 minutes.</p>
                            <button id="sendResetButton" class="resetbutton" type="button">Send Verification Code</button>
                            <div id="resetStatus" class="resetstatus"></div>
                            <form id="resetVerifyForm" class="resetform hidden">
                                <label for="reset-code">Verification Code</label>
                                <input class="inputs resetinput" type="text" id="reset-code" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="Enter 6-digit code">
                                <label for="reset-new-password">New Password</label>
                                <input class="inputs resetinput" type="password" id="reset-new-password" autocomplete="new-password" placeholder="Enter your new password">
                                <button class="authsubmit" type="submit">Update Password</button>
                            </form>
                        </div>
                        <button id="logoutButton" class="resetbutton logoutbutton" type="button">Logout</button>
                    </div>
                ` : ''}
            </div>
        `;

        const openResetButton = document.getElementById("openResetButton");
        const resetPanel = document.getElementById("resetPanel");
        const sendResetButton = document.getElementById("sendResetButton");
        const resetStatus = document.getElementById("resetStatus");
        const resetVerifyForm = document.getElementById("resetVerifyForm");
        const logoutButton = document.getElementById("logoutButton");
        const profileSettingsForm = document.getElementById("profileSettingsForm");
        const bioInput = document.getElementById("bioInput");
        const publicEmailToggle = document.getElementById("publicEmailToggle");
        const markdownButtons = document.querySelectorAll(".markdownbutton");

        markdownButtons.forEach((button) => {
            button.addEventListener("click", () => applyMarkdownToBio(button.dataset.markdown));
        });

        if (profileSettingsForm && bioInput && publicEmailToggle) {
            profileSettingsForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                try {
                    const response = await fetch(`/api/users/${encodeURIComponent(route.usernameSlug)}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            viewerUsername: currentUser?.username,
                            bio: bioInput.value,
                            publicEmail: publicEmailToggle.checked
                        })
                    });

                    if (!response.ok) {
                        return;
                    }

                    window.location.reload();
                } catch (error) {
                    console.error("Failed to update profile:", error);
                }
            });
        }

        if (openResetButton && resetPanel) {
            openResetButton.addEventListener("click", () => {
                resetPanel.classList.remove("hidden");
                openResetButton.classList.add("hidden");
            });
        }

        if (sendResetButton && resetStatus && resetVerifyForm) {
            sendResetButton.addEventListener("click", async () => {
                resetStatus.textContent = "Sending code...";

                try {
                    const response = await fetch("/api/password-reset/request", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ username: route.usernameSlug })
                    });

                    const data = await response.json();
                    if (data.verificationCode) {
                        resetStatus.textContent = `${data.message || "Verification code generated locally."} Code: ${data.verificationCode}`;
                    } else {
                        resetStatus.textContent = data.message || "Verification code sent.";
                    }
                    resetVerifyForm.classList.remove("hidden");
                    sendResetButton.classList.add("hidden");
                } catch (error) {
                    console.error("Failed to request password reset:", error);
                    resetStatus.textContent = "Unable to send verification code.";
                }
            });
        }

        if (resetVerifyForm && resetStatus) {
            resetVerifyForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                const code = document.getElementById("reset-code").value;
                const newPassword = document.getElementById("reset-new-password").value;
                resetStatus.textContent = "Updating password...";

                try {
                    const response = await fetch("/api/password-reset/verify", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            code,
                            newPassword
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        resetStatus.textContent = data.message || "Password update failed.";
                        return;
                    }

                    localStorage.removeItem("currentUser");
                    window.location.href = "/login/";
                } catch (error) {
                    console.error("Failed to update password:", error);
                    resetStatus.textContent = "Password update failed.";
                }
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener("click", () => {
                localStorage.removeItem("currentUser");
                window.location.href = "/login/";
            });
        }
    } catch (error) {
        console.error("Failed to load user profile:", error);
        container.innerHTML = `
            <div class="topicdetail">
                <h1 class="topicdetailtitle">Profile unavailable</h1>
                <p class="topicdetailtext">We couldn't load this profile right now.</p>
            </div>
        `;
    }
}

const toggle = document.getElementById("themetoggler");

if (toggle) {
    toggle.addEventListener("click", () => {
        const isDark = document.body.classList.toggle("dark");

        if (isDark) {
            localStorage.setItem("theme", "dark");
            toggle.textContent = "Light Mode";
        } else {
            localStorage.setItem("theme", "light");
            toggle.textContent = "Dark Mode";
        }

        document.dispatchEvent(new CustomEvent("themechange", { detail: { dark: isDark } }));
    });
}

if (
    localStorage.getItem("theme") === "dark" ||
    (!localStorage.getItem("theme") &&
     window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
    document.body.classList.add("dark");
    const toggle = document.getElementById("themetoggler");
    if (toggle) {
        toggle.textContent = "Light Mode";
    }
}

async function pingServer() {

    try {
        const response = await fetch('/api/status');
        const data = await response.json();
    } catch (error) {
        console.error("Failed to connect to the backend:", error);
    }
}

async function courseLoad() {
    try {
        const response = await fetch('/api/topics');
        const topics = await response.json();
        const route = getTopicRoute();

        if (route.view === "subtopic") {
            renderSubtopicDetail(topics, route.topicSlug, route.subtopicSlug);
            return;
        }

        if (route.view === "topic") {
            renderTopicDetail(topics, route.topicSlug);
            return;
        }

        renderTopicIndex(topics);
    } catch (error) {
        console.error("Failed to fetch topic catalog:", error);
    }
}

function checkUserStatus() {
    const userStatus = localStorage.getItem("currentUser");
    if(!userStatus) return;

    try {
        const parsed = JSON.parse(userStatus);
        const user = parsed.user || parsed;
        const tablist = document.querySelector(".tablist");

        if (tablist) {
            const loginLink = tablist.querySelector("a[href='/login/']");
            if (loginLink) {
                const loginListItem = loginLink.parentElement;
                loginListItem.innerHTML = `
                    <a class="profilemenulink" href="/profile/${encodeURIComponent(user.username)}">Profile</a>
                `;
            }
        }

    } catch (error) {
        console.error("Error checking user status:", error);
    }
}

function initUserSearch() {
    const form = document.getElementById("user-search-form");
    const input = document.getElementById("user-search");

    if (!form || !input) {
        return;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const username = input.value.trim();

        if (!username) {
            return;
        }

        window.location.href = `/profile/${encodeURIComponent(username)}`;
    });
}

document.addEventListener("DOMContentLoaded", () => {
    checkUserStatus();
    initUserSearch();
    const profileRoute = getProfileRoute();

    if (profileRoute.view === "profile") {
        renderProfilePage();
    } else {
        courseLoad();
    }
    pingServer();
});
