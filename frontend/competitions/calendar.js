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
                <span class="competitiontitle">${contest.title}</span><br>
                <span class="competitiontime">${contest.start_time} - ${contest.end_time}</span>
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

document.addEventListener("DOMContentLoaded", () => {
    const prevButton = document.getElementById("prevmonth");
    const nextButton = document.getElementById("nextmonth");
    
    if (prevButton) prevButton.addEventListener("click", getPreviousMonth);
    if (nextButton) nextButton.addEventListener("click", getNextMonth);
    
    calLoad();
});