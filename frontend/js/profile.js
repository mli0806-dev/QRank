import { escapeHtml, renderMarkdown, autoResizeTextarea } from './core/dom.js';
import { getCurrentUser } from './core/auth-state.js';
import { initMarkdownToolbar, renderMarkdownToolbar } from './core/markdown-toolbar.js';

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
        const currentUser = await getCurrentUser();
        const response = await fetch(`/api/users/${encodeURIComponent(route.usernameSlug)}`);
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
                <div class="profiledetailpanel">
                    <p class="topicdetailtext"><span>User ID:</span> ${escapeHtml(user.id)}</p>
                    <p class="topicdetailtext"><span>QScore:</span> ${escapeHtml(user.qscore)}</p>
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
                                ${renderMarkdownToolbar()}
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
                                <input class="inputs resetinput" type="password" id="reset-new-password" autocomplete="new-password" placeholder="Enter your new password" minlength="8" required>
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
        initMarkdownToolbar(".markdownbutton", bioInput);

        if (bioInput) {
            autoResizeTextarea(bioInput);
            bioInput.addEventListener("input", () => autoResizeTextarea(bioInput));
        }

        if (profileSettingsForm && bioInput && publicEmailToggle) {
            profileSettingsForm.addEventListener("submit", async (event) => {
                event.preventDefault();

                try {
                    const response = await fetch(`/api/users/${encodeURIComponent(route.usernameSlug)}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
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
                            username: route.usernameSlug,
                            code,
                            newPassword
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        resetStatus.textContent = data.message || "Password update failed.";
                        return;
                    }

                    window.location.href = "/login/";
                } catch (error) {
                    console.error("Failed to update password:", error);
                    resetStatus.textContent = "Password update failed.";
                }
            });
        }

        if (logoutButton) {
            logoutButton.addEventListener("click", async () => {
                try {
                    await fetch("/api/logout", { method: "POST" });
                } catch (error) {
                    console.error("Logout request failed:", error);
                }
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

export { renderProfilePage };
