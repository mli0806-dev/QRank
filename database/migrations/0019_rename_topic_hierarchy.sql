SET @topicsTableExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'topics'
);
SET @coursesTableExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses'
);
SET @ddl = IF(@topicsTableExists = 1 AND @coursesTableExists = 0,
    'RENAME TABLE topics TO courses, subtopics TO topics, units TO subtopics',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'topics' AND COLUMN_NAME = 'topic_id'
);
SET @ddl = IF(@columnExists = 1,
    'ALTER TABLE topics CHANGE COLUMN topic_id course_id INT DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subtopics' AND COLUMN_NAME = 'subtopic_id'
);
SET @ddl = IF(@columnExists = 1,
    'ALTER TABLE subtopics CHANGE COLUMN subtopic_id topic_id INT NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND COLUMN_NAME = 'topic'
);
SET @ddl = IF(@columnExists = 1,
    'ALTER TABLE problem_sets CHANGE COLUMN topic course VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND COLUMN_NAME = 'subtopic'
);
SET @ddl = IF(@columnExists = 1,
    'ALTER TABLE problem_sets CHANGE COLUMN subtopic topic VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND COLUMN_NAME = 'unit'
);
SET @ddl = IF(@columnExists = 1,
    'ALTER TABLE problem_sets CHANGE COLUMN unit subtopic VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_suggestions' AND COLUMN_NAME = 'topic'
);
SET @ddl = IF(@columnExists = 1,
    'ALTER TABLE problem_set_suggestions CHANGE COLUMN topic course VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_suggestions' AND COLUMN_NAME = 'subtopic'
);
SET @ddl = IF(@columnExists = 1,
    'ALTER TABLE problem_set_suggestions CHANGE COLUMN subtopic topic VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_suggestions' AND COLUMN_NAME = 'unit'
);
SET @ddl = IF(@columnExists = 1,
    'ALTER TABLE problem_set_suggestions CHANGE COLUMN unit subtopic VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
