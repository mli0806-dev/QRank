SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'competitions' AND COLUMN_NAME = 'problem_set_id'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE competitions ADD COLUMN problem_set_id INT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraintExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'competitions' AND CONSTRAINT_NAME = 'fk_competitions_problem_set'
);
SET @ddl = IF(@constraintExists = 0,
    'ALTER TABLE competitions ADD CONSTRAINT fk_competitions_problem_set FOREIGN KEY (problem_set_id) REFERENCES problem_sets (id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'competitions' AND COLUMN_NAME = 'is_private'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE competitions ADD COLUMN is_private TINYINT(1) NOT NULL DEFAULT 0',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'competitions' AND COLUMN_NAME = 'join_code'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE competitions ADD COLUMN join_code VARCHAR(64) NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @indexExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'competitions' AND INDEX_NAME = 'idx_competitions_join_code'
);
SET @ddl = IF(@indexExists = 0,
    'ALTER TABLE competitions ADD UNIQUE INDEX idx_competitions_join_code (join_code)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
