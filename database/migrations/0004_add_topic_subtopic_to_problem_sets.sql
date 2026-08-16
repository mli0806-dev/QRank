SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND COLUMN_NAME = 'topic'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_sets ADD COLUMN topic VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND COLUMN_NAME = 'subtopic'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_sets ADD COLUMN subtopic VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @indexExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND INDEX_NAME = 'idx_problem_sets_topic'
);
SET @ddl = IF(@indexExists = 0,
    'ALTER TABLE problem_sets ADD INDEX idx_problem_sets_topic (topic)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @indexExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND INDEX_NAME = 'idx_problem_sets_subtopic'
);
SET @ddl = IF(@indexExists = 0,
    'ALTER TABLE problem_sets ADD INDEX idx_problem_sets_subtopic (subtopic)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
