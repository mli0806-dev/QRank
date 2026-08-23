document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const googleButtons = [
        {
            container: document.getElementById("google-login-button"),
            error: document.getElementById("google-login-error"),
            buttonText: "signin_with"
        },
        {
            container: document.getElementById("google-register-button"),
            error: document.getElementById("google-register-error"),
            buttonText: "signup_with"
        }
    ];

    const registerTerms = document.getElementById("register-terms");
    const googleRegisterButton = document.getElementById("google-register-button");
    const googleRegisterConsent = document.getElementById("google-register-consent");

    if (registerTerms && googleRegisterButton) {
        const syncGoogleConsentState = () => {
            googleRegisterButton.classList.toggle("googledisabled", !registerTerms.checked);
            if (googleRegisterConsent) {
                googleRegisterConsent.classList.toggle("hidden", registerTerms.checked);
            }
        };

        registerTerms.addEventListener("change", syncGoogleConsentState);
        syncGoogleConsentState();
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("login-email").value;
            const password = document.getElementById("login-password").value;
            const errorDiv = document.getElementById("login-error");
            
            try {
                const response = await fetch("/api/login", {    
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({email, password})
                });
                const data = await response.json();
                
                if (!response.ok) {
                    errorDiv.textContent = data.error || data.message || "Login failed.";
                    errorDiv.style.display = "block";
                } else {
                    loginForm.reset();
                    window.location.href = "/";
                }
            } catch (error) {
                console.error("Login error:", error);
                errorDiv.textContent = "Login failed.";
                errorDiv.style.display = "block";
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("register-username").value;
            const email = document.getElementById("register-email").value;
            const password = document.getElementById("register-password").value;
            const errorDiv = document.getElementById("register-error");
            
            try {
                const response = await fetch("/api/register", {    
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({username, email, password})
                });
                const data = await response.json();
                
                if (!response.ok) {
                    errorDiv.textContent = data.error || data.message || "Registration failed.";
                    errorDiv.style.display = "block";
                } else {
                    registerForm.reset();
                }
            } catch (error) {
                console.error("Registration error:", error);
                errorDiv.textContent = "Registration failed.";
                errorDiv.style.display = "block";
            }
        });
    }

    async function waitForGoogleLibrary() {
        if (window.google && window.google.accounts && window.google.accounts.id) {
            return;
        }

        await new Promise((resolve, reject) => {
            const timeout = window.setTimeout(() => {
                clearInterval(interval);
                reject(new Error("Google library did not load."));
            }, 5000);

            const interval = window.setInterval(() => {
                if (window.google && window.google.accounts && window.google.accounts.id) {
                    window.clearTimeout(timeout);
                    window.clearInterval(interval);
                    resolve();
                }
            }, 50);
        });
    }

    async function handleGoogleCredential(credential, errorElement) {
        const loginResponse = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                credential
            })
        });

        const loginData = await loginResponse.json();

        if (!loginResponse.ok) {
            if (errorElement) {
                errorElement.textContent = loginData.message || "Google sign-in failed.";
                errorElement.classList.remove("autherrorhidden");
            }
            return;
        }

        window.location.href = "/";
    }

    function renderGoogleButtons() {
        const activeButtons = googleButtons.filter(({ container }) => container && container.dataset.active === "true");

        if (activeButtons.length === 0 || !window.google?.accounts?.id) {
            return;
        }

        for (const { container, buttonText } of activeButtons) {
            container.innerHTML = "";
            window.google.accounts.id.renderButton(container, {
                theme: "outline",
                size: "large",
                width: 280,
                text: buttonText,
                shape: "rectangular"
            });
        }
    }

    async function initializeGoogleLogin() {
        const activeButtons = googleButtons.filter(({ container }) => container);
        if (activeButtons.length === 0) {
            return;
        }

        try {
            const response = await fetch("/api/auth/google-config");
            const data = await response.json();

            if (!response.ok || !data.enabled || !data.clientId) {
                for (const { error } of activeButtons) {
                    if (error) {
                        error.textContent = data.message || "Google sign-in is not configured.";
                        error.classList.remove("autherrorhidden");
                    }
                }
                return;
            }

            await waitForGoogleLibrary();

            window.google.accounts.id.initialize({
                client_id: data.clientId,
                callback: async (credentialResponse) => {
                    const activeError = googleButtons.find(({ container }) => container && container.dataset.active === "true")?.error || null;

                    try {
                        await handleGoogleCredential(credentialResponse.credential, activeError);
                    } catch (error) {
                        console.error("Google login error:", error);
                        if (activeError) {
                            activeError.textContent = "Google sign-in failed.";
                            activeError.classList.remove("autherrorhidden");
                        }
                    }
                }
            });

            for (const { container, error, buttonText } of activeButtons) {
                if (error) {
                    error.textContent = "";
                    error.classList.add("autherrorhidden");
                }

                container.dataset.active = "true";
            }

            renderGoogleButtons();
        } catch (error) {
            console.error("Google button initialization failed:", error);
            for (const { error: errorElement } of googleButtons) {
                if (errorElement) {
                    errorElement.textContent = "Google sign-in failed to load.";
                    errorElement.classList.remove("autherrorhidden");
                }
            }
        }
    }

    initializeGoogleLogin();

    const openLoginResetButton = document.getElementById("openLoginResetButton");
    const loginResetPanel = document.getElementById("loginResetPanel");
    const loginSendResetButton = document.getElementById("loginSendResetButton");
    const loginResetStatus = document.getElementById("loginResetStatus");
    const loginResetVerifyForm = document.getElementById("loginResetVerifyForm");
    const loginResetIdentifier = document.getElementById("login-reset-identifier");

    if (openLoginResetButton && loginResetPanel) {
        openLoginResetButton.addEventListener("click", () => {
            loginResetPanel.classList.remove("hidden");
            openLoginResetButton.classList.add("hidden");
        });
    }

    let loginResetIdentifierValue = "";

    if (loginSendResetButton && loginResetStatus && loginResetVerifyForm && loginResetIdentifier) {
        loginSendResetButton.addEventListener("click", async () => {
            const identifier = loginResetIdentifier.value.trim();

            if (!identifier) {
                loginResetStatus.textContent = "Enter your username or email first.";
                return;
            }

            loginResetStatus.textContent = "Sending code...";

            const isEmail = identifier.includes("@");

            try {
                const response = await fetch("/api/password-reset/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(isEmail ? { email: identifier } : { username: identifier })
                });

                const data = await response.json();
                loginResetIdentifierValue = identifier;

                if (data.verificationCode) {
                    loginResetStatus.textContent = `${data.message || "Verification code generated locally."} Code: ${data.verificationCode}`;
                } else {
                    loginResetStatus.textContent = data.message || "Verification code sent.";
                }

                loginResetVerifyForm.classList.remove("hidden");
                loginSendResetButton.classList.add("hidden");
                loginResetIdentifier.disabled = true;
            } catch (error) {
                console.error("Failed to request password reset:", error);
                loginResetStatus.textContent = "Unable to send verification code.";
            }
        });
    }

    if (loginResetVerifyForm && loginResetStatus) {
        loginResetVerifyForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const code = document.getElementById("login-reset-code").value;
            const newPassword = document.getElementById("login-reset-new-password").value;
            const isEmail = loginResetIdentifierValue.includes("@");
            loginResetStatus.textContent = "Updating password...";

            try {
                const response = await fetch("/api/password-reset/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...(isEmail ? { email: loginResetIdentifierValue } : { username: loginResetIdentifierValue }),
                        code,
                        newPassword
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    loginResetStatus.textContent = data.message || "Password update failed.";
                    return;
                }

                loginResetStatus.textContent = "Password updated. You can log in now.";
                loginResetVerifyForm.classList.add("hidden");
            } catch (error) {
                console.error("Failed to update password:", error);
                loginResetStatus.textContent = "Password update failed.";
            }
        });
    }
});
