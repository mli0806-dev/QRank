SET @is_tidb = (SELECT VERSION() LIKE '%TiDB%');
SET @tableExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_set_timers'
);
SET @ddl = IF(@tableExists > 0, 'SELECT 1', IF(@is_tidb,
    'CREATE TABLE problem_set_timers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        problem_set_id INT NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_problem_set_timer (user_id, problem_set_id),
        INDEX idx_problem_set_timers_user (user_id),
        CONSTRAINT fk_problem_set_timers_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_problem_set_timers_set FOREIGN KEY (problem_set_id) REFERENCES problem_sets (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1',
    'CREATE TABLE problem_set_timers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        problem_set_id INT NOT NULL,
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user_problem_set_timer (user_id, problem_set_id),
        INDEX idx_problem_set_timers_user (user_id),
        CONSTRAINT fk_problem_set_timers_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        CONSTRAINT fk_problem_set_timers_set FOREIGN KEY (problem_set_id) REFERENCES problem_sets (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
));
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
