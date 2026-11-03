import { escapeHtml } from '../core/dom.js';
import { getCurrentUser } from '../core/auth-state.js';

function safeResourceUrl(url) {
    try {
        const parsed = new URL(url, window.location.origin);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
    } catch {
        return null;
    }
}

function renderResource(resource, isAdmin) {
    const href = safeResourceUrl(resource.url);

    if (!href) {
        return '';
    }

    const description = resource.description
        ? `<span class="topicresourcedescription">${escapeHtml(resource.description)}</span>`
        : '';
    const remove = isAdmin
        ? `<button type="button" class="topicresourcedelete" data-resource-id="${escapeHtml(resource.id)}" aria-label="Delete ${escapeHtml(resource.title)}">&times;</button>`
        : '';

    return `
        <li class="topicresourceitem">
            <a class="topicresourcelink" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
                <span class="topicresourcetitle">${escapeHtml(resource.title)}</span>
                ${description}
            </a>
            ${remove}
        </li>
    `;
}

function renderResourceForm() {
    return `
        <form class="topicresourceform">
            <input type="text" class="inputs topicresourceinput" name="title" placeholder="Title" maxlength="150" autocomplete="off" required>
            <input type="url" class="inputs topicresourceinput" name="url" placeholder="https://example.com" maxlength="500" autocomplete="off" required>
            <input type="text" class="inputs topicresourceinput" name="description" placeholder="Description (optional)" maxlength="300" autocomplete="off">
            <button type="submit" class="authsubmit">Add resource</button>
            <p class="topicresourceerror hidden" role="alert"></p>
        </form>
    `;
}

function renderResourceList(resources, isAdmin) {
    const items = resources.map((resource) => renderResource(resource, isAdmin)).join('');

    return items
        ? `<ul class="topicresourcelist">${items}</ul>`
        : '<div class="problemsetempty"><p>No resources have been added for this topic yet.</p></div>';
}

async function initTopicResources(topicId) {
    const section = document.getElementById("topicresources");

    if (!section || !topicId) {
        return;
    }

    const user = await getCurrentUser();
    const isAdmin = user?.role === "admin";
    let resources = [];

    try {
        const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/resources`);

        if (!response.ok) {
            throw new Error(`API error ${response.status} ${response.statusText}`);
        }

        resources = (await response.json()).resources || [];
    } catch (error) {
        console.error("Failed to load topic resources:", error);
        section.innerHTML = `
            <h3 class="topicdetailitemtitle">Resources</h3>
            <div class="problemsetempty"><p>Unable to load resources for this topic right now.</p></div>
        `;
        return;
    }

    const paint = () => {
        section.innerHTML = `
            <h3 class="topicdetailitemtitle">Resources</h3>
            ${renderResourceList(resources, isAdmin)}
            ${isAdmin ? renderResourceForm() : ''}
        `;

        if (!isAdmin) {
            return;
        }

        section.querySelectorAll(".topicresourcedelete").forEach((button) => {
            button.addEventListener("click", async () => {
                const id = button.dataset.resourceId;
                button.disabled = true;

                try {
                    const response = await fetch(`/api/topic-resources/${encodeURIComponent(id)}`, { method: "DELETE" });

                    if (!response.ok) {
                        throw new Error(`API error ${response.status}`);
                    }

                    resources = resources.filter((resource) => String(resource.id) !== String(id));
                    paint();
                } catch (error) {
                    console.error("Failed to delete topic resource:", error);
                    button.disabled = false;
                }
            });
        });

        const form = section.querySelector(".topicresourceform");
        const error = section.querySelector(".topicresourceerror");

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            error.classList.add("hidden");

            const payload = {
                title: form.title.value.trim(),
                url: form.url.value.trim(),
                description: form.description.value.trim()
            };

            try {
                const response = await fetch(`/api/topics/${encodeURIComponent(topicId)}/resources`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || "Failed to add resource.");
                }

                resources = [...resources, data.resource];
                paint();
            } catch (submitError) {
                error.textContent = submitError.message;
                error.classList.remove("hidden");
            }
        });
    };

    paint();
}

export { initTopicResources };
