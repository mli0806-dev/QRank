function toggleDropdown(button) {
    const dropdown = button.parentElement.nextElementSibling

    const isopen = dropdown.classList.toggle("show");
    button.classList.toggle("open", isopen);
}

const toggle = document.getElementById("themetoggler");

if (toggle) {
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
    const statusText = document.getElementById("server-status");

    if (!statusText) {
        return
    }

    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        statusText.textContent = `Backend is ${data.status}`;
    } catch (error) {
        console.error("Failed to connect to the backend:", error);
        statusText.textContent = "Backend is offline.";
    }
}

async function courseLoad() {
    try {
        const response = await fetch('/api/topics');
        const topics = await response.json();
        const container = document.getElementById("coursecontainer");

        container.innerHTML = topics.map(topic => {

            const subtopicshtml = topic.subtopics.map(subtopic => {
                const tagarray = subtopic.tags ? subtopic.tags.split(', ') : [];
                const tagshtml = tagarray.map(tag => `
                        <span class="tag">(${tag})</span>
                    `).join(' ');

                    return `
                        <a href="/problemset.html?subtopic=${subtopic.id}">
                            ${subtopic.name} ${tagshtml}
                        </a>
                    `;

            }).join(' ');

            return `
                <div class="topicboxes">
                    <div class="topicheader">
                        <h3 class="topictitle">${topic.topic}</h3>
                        <button class="dropdownbutton" onclick="toggleDropdown(this)">⌄</button>
                    </div>
                    <div class="dropdowncontent">
                        ${subtopicshtml || '<a href="#">No subtopics available</a>'}
                    </div>
                </div>
            `;

        }).join(' ');
    } catch (error) {
        console.error("Failed to fetch topic catalog:", error);
    }
}

document.addEventListener("DOMContentLoaded", courseLoad)

document.addEventListener("DOMContentLoaded", () => {
    pingServer();
});