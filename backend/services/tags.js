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

async function getCourseTagsForTopic(queryable, course, topic) {
    if (!course || !topic) {
        return [];
    }

    const [rows] = await queryable.query(
        `
        SELECT topics.tags
        FROM topics
        JOIN courses ON courses.id = topics.course_id
        WHERE courses.name = ? AND topics.name = ?
        LIMIT 1
        `,
        [course, topic]
    );

    if (rows.length === 0 || !rows[0].tags) {
        return [];
    }

    return splitTags(rows[0].tags);
}

module.exports = { splitTags, mergeTags, getCourseTagsForTopic };
