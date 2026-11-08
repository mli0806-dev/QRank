SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_timers' AND COLUMN_NAME = 'elapsed_seconds'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_set_timers ADD COLUMN elapsed_seconds INT NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_timers' AND COLUMN_NAME = 'last_seen_at'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_set_timers ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
