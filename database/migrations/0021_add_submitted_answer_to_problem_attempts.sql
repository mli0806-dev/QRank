SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_attempts' AND COLUMN_NAME = 'submitted_answer'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_attempts ADD COLUMN submitted_answer TEXT',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
