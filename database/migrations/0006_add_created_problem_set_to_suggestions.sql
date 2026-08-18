SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_suggestions' AND COLUMN_NAME = 'created_problem_set_id'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE problem_set_suggestions ADD COLUMN created_problem_set_id INT DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fkExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_suggestions' AND CONSTRAINT_NAME = 'fk_suggestions_created_problem_set'
);
SET @ddl = IF(@fkExists = 0,
    'ALTER TABLE problem_set_suggestions ADD CONSTRAINT fk_suggestions_created_problem_set FOREIGN KEY (created_problem_set_id) REFERENCES problem_sets(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
