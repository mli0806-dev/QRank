function toggleDropdown(button) {
    const dropdown = button.parentElement.nextElementSibling

    const isopen = dropdown.classList.toggle("show");
    button.classList.toggle("open", isopen);
}

const toggle = document.getElementById("themetoggler");

toggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    if(document.body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
        toggle.textContent = "Light Mode";
    } else { 
        localStorage.setItem("theme","light");
        toggle.textContent = "Dark Mode";
    }
});

if (
    localStorage.getItem("theme") === "dark" ||
    (!localStorage.getItem("theme") &&
     window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
    document.body.classList.add("dark");
}