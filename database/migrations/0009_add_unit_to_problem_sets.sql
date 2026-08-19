SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND COLUMN_NAME = 'unit'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_sets ADD COLUMN unit VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_suggestions' AND COLUMN_NAME = 'unit'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_set_suggestions ADD COLUMN unit VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @indexExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_sets' AND INDEX_NAME = 'idx_problem_sets_unit'
);
SET @ddl = IF(@indexExists = 0,
    'ALTER TABLE problem_sets ADD INDEX idx_problem_sets_unit (unit)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
