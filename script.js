function toggleDropdown(button) {
    const dropdown = button.parentElement.nextElementSibling

    const isopen = dropdown.classList.toggle("show");
    button.classList.toggle("open", isopen);
}

