function splitTags(tagsString) {
    return String(tagsString || "")
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean);
}

function mergeTags(manualTags, courseTags) {
    const seen = new Set();
    const merged = [];

    for (const tag of [...manualTags, ...courseTags]) {
        const key = tag.toLowerCase();
        if (tag && !seen.has(key)) {
            seen.add(key);
            merged.push(tag);
        }
    }

    return merged.join(',');
}

async function getCourseTagsForSubtopic(queryable, topic, subtopic) {
    if (!topic || !subtopic) {
        return [];
    }

    const [rows] = await queryable.query(
        `
        SELECT subtopics.tags
        FROM subtopics
        JOIN topics ON topics.id = subtopics.topic_id
        WHERE topics.name = ? AND subtopics.name = ?
        LIMIT 1
        `,
        [topic, subtopic]
    );

    if (rows.length === 0 || !rows[0].tags) {
        return [];
    }

    return splitTags(rows[0].tags);
}

module.exports = { splitTags, mergeTags, getCourseTagsForSubtopic };
