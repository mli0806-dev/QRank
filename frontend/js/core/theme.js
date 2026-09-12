function updateSiteLogo(isDark) {
    const src = isDark ? "/images/dark-logo.png?v=3" : "/images/logo.png?v=3";
    document.querySelectorAll(".sitetitlelogo").forEach((img) => {
        img.src = src;
    });
}

function initTheme() {
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

            updateSiteLogo(isDark);
            document.dispatchEvent(new CustomEvent("themechange", { detail: { dark: isDark } }));
        });
    }

    const prefersDarkScheme = typeof window.matchMedia === 'function'
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
        : false;

    if (
        localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && prefersDarkScheme)
    ) {
        document.body.classList.add("dark");
        updateSiteLogo(true);
        const toggle = document.getElementById("themetoggler");
        if (toggle) {
            toggle.textContent = "Light Mode";
        }
    }
}

export { initTheme };
