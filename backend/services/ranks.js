const RANKS = [
    { key: "wood", label: "Wood", minScore: 0 },
    { key: "bronze", label: "Bronze", minScore: 100 },
    { key: "silver", label: "Silver", minScore: 500 },
    { key: "gold", label: "Gold", minScore: 1000 },
    { key: "emerald", label: "Emerald", minScore: 2000 },
    { key: "diamond", label: "Diamond", minScore: 3000 },
    { key: "platinum", label: "Platinum", minScore: 5000 },
    { key: "master", label: "Master", minScore: 8000 }
];

function rankForScore(qscore) {
    const score = Number.isFinite(Number(qscore)) ? Number(qscore) : 0;

    let current = RANKS[0];

    for (const rank of RANKS) {
        if (score >= rank.minScore) {
            current = rank;
        }
    }

    const next = RANKS[RANKS.indexOf(current) + 1] || null;

    return {
        key: current.key,
        label: current.label,
        minScore: current.minScore,
        nextLabel: next ? next.label : null,
        nextScore: next ? next.minScore : null
    };
}

module.exports = { rankForScore };
