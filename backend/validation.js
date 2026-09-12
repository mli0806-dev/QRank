const { z } = require('zod');

const registerSchema = z.object({
    username: z
        .string()
        .trim()
        .regex(/^[a-zA-Z0-9_]{3,32}$/, "Username must be 3-32 characters and contain only letters, numbers, and underscores."),
    email: z.string().trim().max(255).email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters.").max(128, "Password is too long.")
});

const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, "Email and password are required.")
        .max(255)
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address."),
    password: z.string().min(1, "Email and password are required.").max(128)
});

const competitionCreateSchema = z.object({
    title: z.string().trim().min(1).max(255),
    startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date.")
        .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid start date."),
    endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date.")
        .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid end date."),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid start time."),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid end time.")
});

const calendarQuerySchema = z.object({
    year: z
        .string()
        .regex(/^\d{4}$/)
        .refine((value) => Number(value) >= 1970 && Number(value) <= 2999, "Year out of range."),
    month: z
        .string()
        .regex(/^\d{1,2}$/)
        .refine((value) => Number(value) >= 1 && Number(value) <= 12, "Month out of range.")
});

const suggestionProblemSchema = z.object({
    type: z.string(),
    prompt: z.string().min(1).max(5000),
    choices: z.array(z.string().max(500)).max(10).optional(),
    answer: z.string().min(1).max(2000),
    points: z.number().optional(),
    explanation: z.string().max(5000).optional()
});

const suggestionProblemsArraySchema = z.array(suggestionProblemSchema).min(1).max(100);

const MAX_SUGGESTION_PROBLEMS_JSON_LENGTH = 50 * 1024;

function validateSuggestionProblemsPayload(rawProblems) {
    const raw = String(rawProblems ?? "");

    if (raw.length > MAX_SUGGESTION_PROBLEMS_JSON_LENGTH) {
        return { success: false, message: "Problems payload is too large." };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return { success: false, message: "Problems payload must be valid JSON." };
    }

    const result = suggestionProblemsArraySchema.safeParse(parsed);

    if (!result.success) {
        return { success: false, message: "Problems payload is malformed." };
    }

    return { success: true };
}

module.exports = {
    registerSchema,
    loginSchema,
    competitionCreateSchema,
    calendarQuerySchema,
    validateSuggestionProblemsPayload
};
