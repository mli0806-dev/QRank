SET @is_tidb = (SELECT VERSION() LIKE '%TiDB%');

SET @ddl = IF(@is_tidb, 'ALTER TABLE problems DROP FOREIGN KEY fk_problems_problem_set', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE problem_set_suggestions DROP FOREIGN KEY fk_suggestions_created_problem_set', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE problem_set_suggestions DROP FOREIGN KEY fk_suggestions_editing_problem_set', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE competitions DROP FOREIGN KEY fk_competitions_problem_set', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE saved_competitions DROP FOREIGN KEY fk_saved_competitions_competition', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE saved_competitions DROP FOREIGN KEY fk_saved_competitions_user', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE leaderboard DROP FOREIGN KEY leaderboard_ibfk_1', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM problem_sets);
SET @ddl = IF(@is_tidb, 'DROP TABLE IF EXISTS problem_sets_new', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, CONCAT('CREATE TABLE problem_sets_new (
      id int NOT NULL AUTO_INCREMENT,
      name varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      description text COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      tags varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      topic varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      subtopic varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      unit varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      calculator_allowed tinyint(1) NOT NULL DEFAULT \'0\',
      PRIMARY KEY (id),
      KEY idx_problem_sets_name (name),
      KEY idx_problem_sets_tags (tags),
      KEY idx_problem_sets_topic (topic),
      KEY idx_problem_sets_subtopic (subtopic),
      KEY idx_problem_sets_unit (unit)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id), 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'INSERT INTO problem_sets_new SELECT * FROM problem_sets', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'RENAME TABLE problem_sets TO problem_sets_old, problem_sets_new TO problem_sets', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'DROP TABLE problem_sets_old', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM problems);
SET @ddl = IF(@is_tidb, 'DROP TABLE IF EXISTS problems_new', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, CONCAT('CREATE TABLE problems_new (
      id int NOT NULL AUTO_INCREMENT,
      problem_set_id int NOT NULL,
      position int NOT NULL DEFAULT \'0\',
      type enum(\'multiple_choice\',\'free_response\') COLLATE utf8mb4_0900_ai_ci NOT NULL,
      prompt text COLLATE utf8mb4_0900_ai_ci NOT NULL,
      choices json DEFAULT NULL,
      answer varchar(500) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      PRIMARY KEY (id),
      KEY idx_problems_problem_set (problem_set_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id), 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'INSERT INTO problems_new SELECT * FROM problems', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'RENAME TABLE problems TO problems_old, problems_new TO problems', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'DROP TABLE problems_old', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM competitions);
SET @ddl = IF(@is_tidb, 'DROP TABLE IF EXISTS competitions_new', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, CONCAT('CREATE TABLE competitions_new (
      id int NOT NULL AUTO_INCREMENT,
      title varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      start_date date NOT NULL,
      end_date date NOT NULL,
      category varchar(100) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      start_time time DEFAULT NULL,
      end_time time DEFAULT NULL,
      problem_set_id int DEFAULT NULL,
      is_private tinyint(1) NOT NULL DEFAULT \'0\',
      join_code varchar(64) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      PRIMARY KEY (id),
      KEY fk_competitions_problem_set (problem_set_id),
      UNIQUE KEY idx_competitions_join_code (join_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id), 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'INSERT INTO competitions_new SELECT * FROM competitions', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'RENAME TABLE competitions TO competitions_old, competitions_new TO competitions', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'DROP TABLE competitions_old', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM sessions);
SET @ddl = IF(@is_tidb, 'DROP TABLE IF EXISTS sessions_new', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, CONCAT('CREATE TABLE sessions_new (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      token_hash char(64) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at datetime NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY idx_sessions_token_hash (token_hash),
      KEY idx_sessions_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id), 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'INSERT INTO sessions_new SELECT * FROM sessions', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'RENAME TABLE sessions TO sessions_old, sessions_new TO sessions', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'DROP TABLE sessions_old', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM leaderboard);
SET @ddl = IF(@is_tidb, 'DROP TABLE IF EXISTS leaderboard_new', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, CONCAT('CREATE TABLE leaderboard_new (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      score int DEFAULT \'0\',
      solved_at timestamp DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id), 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'INSERT INTO leaderboard_new SELECT * FROM leaderboard', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'RENAME TABLE leaderboard TO leaderboard_old, leaderboard_new TO leaderboard', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'DROP TABLE leaderboard_old', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM saved_competitions);
SET @ddl = IF(@is_tidb, 'DROP TABLE IF EXISTS saved_competitions_new', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, CONCAT('CREATE TABLE saved_competitions_new (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      competition_id int NOT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_competition (user_id,competition_id),
      KEY idx_saved_competitions_user (user_id),
      KEY fk_saved_competitions_competition (competition_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id), 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'INSERT INTO saved_competitions_new SELECT * FROM saved_competitions', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'RENAME TABLE saved_competitions TO saved_competitions_old, saved_competitions_new TO saved_competitions', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'DROP TABLE saved_competitions_old', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM password_reset_codes);
SET @ddl = IF(@is_tidb, 'DROP TABLE IF EXISTS password_reset_codes_new', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, CONCAT('CREATE TABLE password_reset_codes_new (
      id int NOT NULL AUTO_INCREMENT,
      user_id int NOT NULL,
      email varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      code_hash varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      expires_at datetime NOT NULL,
      used_at datetime DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_password_reset_user_id (user_id),
      KEY idx_password_reset_email (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id), 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'INSERT INTO password_reset_codes_new SELECT * FROM password_reset_codes', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'RENAME TABLE password_reset_codes TO password_reset_codes_old, password_reset_codes_new TO password_reset_codes', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'DROP TABLE password_reset_codes_old', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @next_id = (SELECT COALESCE(MAX(id), 0) + 1 FROM problem_set_suggestions);
SET @ddl = IF(@is_tidb, 'DROP TABLE IF EXISTS problem_set_suggestions_new', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, CONCAT('CREATE TABLE problem_set_suggestions_new (
      id int NOT NULL AUTO_INCREMENT,
      name varchar(255) COLLATE utf8mb4_0900_ai_ci NOT NULL,
      description text COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      topic varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      subtopic varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      tags varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      problems text COLLATE utf8mb4_0900_ai_ci NOT NULL,
      submitter varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      status enum(\'pending\',\'reviewed\',\'approved\',\'rejected\') COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT \'pending\',
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_problem_set_id int DEFAULT NULL,
      editing_problem_set_id int DEFAULT NULL,
      unit varchar(255) COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
      calculator_allowed tinyint(1) NOT NULL DEFAULT \'0\',
      PRIMARY KEY (id),
      KEY idx_suggestions_topic (topic),
      KEY idx_suggestions_subtopic (subtopic),
      KEY idx_suggestions_status (status),
      KEY fk_suggestions_created_problem_set (created_problem_set_id),
      KEY fk_suggestions_editing_problem_set (editing_problem_set_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1 AUTO_INCREMENT=', @next_id), 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'INSERT INTO problem_set_suggestions_new SELECT * FROM problem_set_suggestions', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'RENAME TABLE problem_set_suggestions TO problem_set_suggestions_old, problem_set_suggestions_new TO problem_set_suggestions', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(@is_tidb, 'DROP TABLE problem_set_suggestions_old', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE problems ADD CONSTRAINT fk_problems_problem_set FOREIGN KEY (problem_set_id) REFERENCES problem_sets (id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE problem_set_suggestions ADD CONSTRAINT fk_suggestions_created_problem_set FOREIGN KEY (created_problem_set_id) REFERENCES problem_sets (id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE problem_set_suggestions ADD CONSTRAINT fk_suggestions_editing_problem_set FOREIGN KEY (editing_problem_set_id) REFERENCES problem_sets (id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE competitions ADD CONSTRAINT fk_competitions_problem_set FOREIGN KEY (problem_set_id) REFERENCES problem_sets (id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE saved_competitions ADD CONSTRAINT fk_saved_competitions_competition FOREIGN KEY (competition_id) REFERENCES competitions (id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE saved_competitions ADD CONSTRAINT fk_saved_competitions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl = IF(@is_tidb, 'ALTER TABLE leaderboard ADD CONSTRAINT leaderboard_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE', 'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
