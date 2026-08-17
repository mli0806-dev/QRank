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
});
