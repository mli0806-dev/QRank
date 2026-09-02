SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND COLUMN_NAME = 'assessment_enabled'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_sets ADD COLUMN assessment_enabled TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_suggestions' AND COLUMN_NAME = 'assessment_enabled'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_set_suggestions ADD COLUMN assessment_enabled TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS settings;
