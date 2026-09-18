function injectHeaderFooter() {
    const nav = document.querySelector("nav.headerbox");
    if (nav) {
        const minimal = nav.dataset.navVariant === "minimal";
        nav.innerHTML = minimal ? `
            <div class="left">
                <a href="/" class="sitetitle"><img src="/images/logo.png?v=3" alt="QRank" class="sitetitlelogo"></a>
            </div>
            <div class="right">
                <button id="themetoggler" class="themebutton">Dark Mode</button>
            </div>
        ` : `
            <div class="left">
                <a href="/" class="sitetitle"><img src="/images/logo.png?v=3" alt="QRank" class="sitetitlelogo"></a>
                <ul class="tablist">
                    <li><a class="tabitems" href="/courses/">Courses</a></li>
                    <li><a class="tabitems" href="/problems/">Problem Sets</a></li>
                    <li><a class="tabitems" href="/competitions/">Competitions</a></li>
                    <li><a class="tabitems" href="/rankings/">Rankings</a></li>
                    <li><a class="tabitems" href="/about/">About Us</a></li>
                    <li><a class="tabitems" href="/contribute/">Contribute</a></li>
                </ul>
            </div>
            <div class="right">
                <button id="themetoggler" class="themebutton">Dark Mode</button>
                <a class="login" href="/login/">Login</a>
            </div>
        `;
    }

    const footer = document.querySelector("footer.sitefooter");
    if (footer) {
        footer.innerHTML = `© 2026 QRank. All rights reserved. · <a class="footerlink" href="/tos/">Terms of Service</a> · <a class="footerlink" href="/privacy/">Privacy Policy</a>`;
    }
}

injectHeaderFooter();

function initMobileNav() {
    const headerLeft = document.querySelector(".headerbox .left");
    const tablist = document.querySelector(".headerbox .tablist");
    if (!headerLeft || !tablist || headerLeft.querySelector(".navtoggle")) {
        return;
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "navtoggle";
    toggle.setAttribute("aria-label", "Toggle navigation menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "☰";
    headerLeft.insertBefore(toggle, tablist);

    const closeMenu = () => {
        tablist.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = "☰";
    };

    toggle.addEventListener("click", () => {
        const isOpen = tablist.classList.toggle("open");
        toggle.setAttribute("aria-expanded", String(isOpen));
        toggle.textContent = isOpen ? "✕" : "☰";
    });

    tablist.addEventListener("click", (event) => {
        if (event.target instanceof Element && event.target.closest("a")) {
            closeMenu();
        }
    });

    document.addEventListener("click", (event) => {
        if (!tablist.classList.contains("open")) {
            return;
        }
        const target = event.target;
        if (target instanceof Element && (tablist.contains(target) || toggle.contains(target))) {
            return;
        }
        closeMenu();
    });
}

export { injectHeaderFooter, initMobileNav };
