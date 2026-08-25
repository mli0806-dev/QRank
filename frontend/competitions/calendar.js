const systemDate = new Date();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

let currentYear = systemDate.getFullYear();
let currentMonth = systemDate.getMonth() + 1;

async function calLoad() {
    try {
        const calMonth = String(currentMonth).padStart(2, '0');
        const response = await fetch(`/api/competitions?year=${currentYear}&month=${calMonth}`);
        const competitions = await response.json();

        const calContainer = document.getElementById("calendarcontainer");
        if (!calContainer) return;
        calContainer.innerHTML = "";

        const monthYear = document.getElementById("monthyear");
        if (monthYear) {
            monthYear.textContent = `${months[currentMonth - 1]} ${currentYear}`;
        }

        const firstDays = new Date(currentYear, currentMonth - 1, 1).getDay();
        const totalDays = new Date(currentYear, currentMonth, 0).getDate();

        for (let i = 0; i < firstDays; i++) {
            const calCell = document.createElement("div");
            calCell.classList.add("calendarcell", "empty");
            calContainer.appendChild(calCell);
        }

        for (let day = 1; day <= totalDays; day++) {
            const dayCell = document.createElement("div");
            dayCell.classList.add("calendarcell");
            
            const dateStr = `${currentYear}-${calMonth}-${String(day).padStart(2, '0')}`;
            dayCell.innerHTML = `<span class="date">${day}</span>`;
            
            const activecontests = competitions.filter(competition => {
                return dateStr >= competition.start_date && dateStr <= competition.end_date;
            });

            activecontests.forEach(contest => {
                const competitionbadge = document.createElement("div");
                competitionbadge.classList.add("competitionbadge");
                competitionbadge.innerHTML = `
                <span class="competitiontitle">${escapeHtml(contest.title)}</span><br>
                <span class="competitiontime">${escapeHtml(contest.start_time)} - ${escapeHtml(contest.end_time)}</span>
                `;
                competitionbadge.addEventListener("click", (e) => {
                    e.stopPropagation();
                    window.location.href = `/competitions/${contest.id}`;
                });
                dayCell.appendChild(competitionbadge);
            });
            calContainer.appendChild(dayCell);
        }

    } catch (error) {
        console.error("Failed to assemble calendar:", error);
    }
}

async function loadSavedCompetitions() {
    const listEl = document.getElementById("savedCompetitionsList");
    const emptyEl = document.getElementById("savedCompetitionsEmpty");
    if (!listEl || !emptyEl) {
        return;
    }

    const currentUser = await getCurrentUser();
    if (!currentUser) {
        emptyEl.textContent = "Log in to save competitions you're interested in.";
        listEl.innerHTML = "";
        return;
    }

    try {
        const response = await fetch("/api/saved-competitions");
        if (!response.ok) {
            throw new Error(`API error ${response.status}`);
        }
        renderSavedCompetitions(await response.json());
    } catch (error) {
        console.error("Failed to load saved competitions:", error);
        emptyEl.textContent = "Unable to load your saved competitions right now.";
        listEl.innerHTML = "";
    }
}

function renderSavedCompetitions(savedCompetitions) {
    const listEl = document.getElementById("savedCompetitionsList");
    const emptyEl = document.getElementById("savedCompetitionsEmpty");
    if (!listEl || !emptyEl) {
        return;
    }

    if (!savedCompetitions.length) {
        emptyEl.textContent = "You haven't saved any competitions yet.";
        listEl.innerHTML = "";
        return;
    }

    emptyEl.textContent = "";
    listEl.innerHTML = savedCompetitions.map((competition) => `
        <li class="savedcompetitionitem">
            <div class="savedcompetitioninfo">
                <a class="savedcompetitiontitle" href="/competitions/${competition.id}">${escapeHtml(competition.title)}</a>
                <span class="savedcompetitiondates">${escapeHtml(competition.start_date)} - ${escapeHtml(competition.end_date)}</span>
            </div>
            <button type="button" class="savedcompetitionremove" data-competition-id="${competition.id}">Remove</button>
        </li>
    `).join("");

    listEl.querySelectorAll(".savedcompetitionremove").forEach((button) => {
        button.addEventListener("click", async () => {
            button.disabled = true;
            try {
                const response = await fetch(`/api/competitions/${encodeURIComponent(button.dataset.competitionId)}/save`, {
                    method: "DELETE"
                });
                if (response.ok) {
                    loadSavedCompetitions();
                } else {
                    button.disabled = false;
                }
            } catch (error) {
                console.error("Failed to remove saved competition:", error);
                button.disabled = false;
            }
        });
    });
}

function getNextMonth() {
    currentMonth++;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    }
    calLoad();
}

function getPreviousMonth() {
    currentMonth--;
    if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    calLoad();
}

async function initAddCompetitionButton() {
    const button = document.getElementById("addCompetitionButton");
    if (!button) {
        return;
    }

    const currentUser = await getCurrentUser();
    if (currentUser && (currentUser.role === "verified" || currentUser.role === "admin")) {
        button.classList.remove("hidden");
    }
}

function initJoinCompetitionForm() {
    const form = document.getElementById("joinCompetitionForm");
    const input = document.getElementById("joinCompetitionCode");
    if (!form || !input) {
        return;
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const code = input.value.trim();
        if (!code) {
            return;
        }

        try {
            const response = await fetch(`/api/competitions/lookup?code=${encodeURIComponent(code)}`);
            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "No competition matches that code.");
                return;
            }

            window.location.href = `/competitions/${encodeURIComponent(data.competitionId)}?code=${encodeURIComponent(code)}`;
        } catch (error) {
            console.error("Failed to look up competition code:", error);
            alert("Unable to look up that code right now.");
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const prevButton = document.getElementById("prevmonth");
    const nextButton = document.getElementById("nextmonth");

    if (prevButton) prevButton.addEventListener("click", getPreviousMonth);
    if (nextButton) nextButton.addEventListener("click", getNextMonth);

    calLoad();
    loadSavedCompetitions();
    initAddCompetitionButton();
    initJoinCompetitionForm();
});