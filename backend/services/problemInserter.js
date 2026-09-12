async function insertProblemsIntoSet(connection, problemSetId, problems) {
    for (let position = 0; position < problems.length; position += 1) {
        const problem = problems[position];
        const type = problem.type === "multiple_choice" ? "multiple_choice" : "free_response";
        const choices = type === "multiple_choice" && Array.isArray(problem.choices)
            ? JSON.stringify(problem.choices)
            : null;
        const points = Number.isFinite(Number(problem.points)) ? Math.max(0, Math.trunc(Number(problem.points))) : 0;
        const explanation = problem.explanation ? String(problem.explanation).trim() || null : null;

        await connection.query(
            "INSERT INTO problems (problem_set_id, position, type, prompt, choices, answer, points, explanation) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [problemSetId, position, type, String(problem.prompt), choices, String(problem.answer), points, explanation]
        );
    }
}

module.exports = { insertProblemsIntoSet };
