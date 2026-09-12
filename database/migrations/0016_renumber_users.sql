SET SESSION group_concat_max_len = 1000000;

DROP TABLE IF EXISTS users_id_remap;

CREATE TABLE users_id_remap (
    old_id INT NOT NULL,
    new_id INT NOT NULL
);

INSERT INTO users_id_remap (old_id, new_id)
SELECT id, ROW_NUMBER() OVER (ORDER BY id) FROM users;

SET @needs_renumber = (SELECT COUNT(*) FROM users_id_remap WHERE old_id <> new_id);
SET @user_count = (SELECT COUNT(*) FROM users_id_remap);
SET @next_id = @user_count + 1;
SET @is_tidb = (SELECT VERSION() LIKE '%TiDB%');

SET @ddl = IF(@needs_renumber > 0,
    'UPDATE sessions s JOIN users_id_remap m ON s.user_id = m.old_id SET s.user_id = m.new_id',
    'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@needs_renumber > 0,
    'UPDATE password_reset_codes p JOIN users_id_remap m ON p.user_id = m.old_id SET p.user_id = m.new_id',
    'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fkExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leaderboard' AND CONSTRAINT_NAME = 'leaderboard_ibfk_1' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@needs_renumber > 0 AND @fkExists > 0, 'ALTER TABLE leaderboard DROP FOREIGN KEY leaderboard_ibfk_1', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fkExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saved_competitions' AND CONSTRAINT_NAME = 'fk_saved_competitions_user' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@needs_renumber > 0 AND @fkExists > 0, 'ALTER TABLE saved_competitions DROP FOREIGN KEY fk_saved_competitions_user', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fkExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_completions' AND CONSTRAINT_NAME = 'fk_problem_completions_user' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@needs_renumber > 0 AND @fkExists > 0, 'ALTER TABLE problem_completions DROP FOREIGN KEY fk_problem_completions_user', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@needs_renumber > 0,
    'UPDATE leaderboard l JOIN users_id_remap m ON l.user_id = m.old_id SET l.user_id = m.new_id',
    'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@needs_renumber > 0,
    'UPDATE saved_competitions sc JOIN users_id_remap m ON sc.user_id = m.old_id SET sc.user_id = m.new_id',
    'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@needs_renumber > 0,
    'UPDATE problem_completions pc JOIN users_id_remap m ON pc.user_id = m.old_id SET pc.user_id = m.new_id',
    'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @values_list = (
    SELECT GROUP_CONCAT(
        CONCAT('(', m.new_id, ',',
            QUOTE(u.username), ',',
            QUOTE(u.email), ',',
            QUOTE(u.password_hash), ',',
            QUOTE(u.role), ',',
            QUOTE(u.created_at), ',',
            QUOTE(u.google_sub), ',',
            u.public_email, ',',
            QUOTE(u.bio), ',',
            u.qscore,
        ')')
        ORDER BY m.new_id
        SEPARATOR ','
    )
    FROM users u JOIN users_id_remap m ON u.id = m.old_id
);

SET @table_body = 'id INT NOT NULL AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT \'user\',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    google_sub VARCHAR(255) DEFAULT NULL,
    public_email TINYINT(1) NOT NULL DEFAULT 0,
    bio TEXT DEFAULT NULL,
    qscore INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY username (username),
    UNIQUE KEY email (email),
    KEY idx_users_google_sub (google_sub)';

SET @ddl = IF(@needs_renumber = 0, 'SELECT 1', 'DROP TABLE IF EXISTS users_new');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @create_sql = IF(@is_tidb,
    CONCAT('CREATE TABLE users_new (', @table_body, ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id),
    CONCAT('CREATE TABLE users_new (', @table_body, ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_INCREMENT=', @next_id)
);
SET @ddl = IF(@needs_renumber = 0, 'SELECT 1', @create_sql);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @insert_sql = IF(@needs_renumber = 0, 'SELECT 1',
    CONCAT('INSERT INTO users_new (id, username, email, password_hash, role, created_at, google_sub, public_email, bio, qscore) VALUES ', @values_list));
PREPARE stmt FROM @insert_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@needs_renumber = 0, 'SELECT 1', 'RENAME TABLE users TO users_old, users_new TO users');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@needs_renumber = 0, 'SELECT 1', 'DROP TABLE IF EXISTS users_old');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fkExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'leaderboard' AND CONSTRAINT_NAME = 'leaderboard_ibfk_1' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@fkExists > 0, 'SELECT 1', 'ALTER TABLE leaderboard ADD CONSTRAINT leaderboard_ibfk_1 FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fkExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'saved_competitions' AND CONSTRAINT_NAME = 'fk_saved_competitions_user' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@fkExists > 0, 'SELECT 1', 'ALTER TABLE saved_competitions ADD CONSTRAINT fk_saved_competitions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fkExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'problem_completions' AND CONSTRAINT_NAME = 'fk_problem_completions_user' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
SET @ddl = IF(@fkExists > 0, 'SELECT 1', 'ALTER TABLE problem_completions ADD CONSTRAINT fk_problem_completions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS users_id_remap;
