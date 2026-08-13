-- Full QRank schema, generated from the live dev database (mysqldump --no-data),
-- cleaned up for portability: no DROP TABLE, no SUPER-privilege-only statements
-- (SQL_LOG_BIN / GTID_PURGED), CREATE TABLE IF NOT EXISTS throughout so this is
-- safe to run against a fresh database or re-run against an existing one.
--
-- Run this once against a new database before deploying anywhere (Vercel or
-- otherwise) — app.js only self-creates password_reset_codes, sessions,
-- problem_sets, and problem_set_suggestions at boot; it never created users,
-- topics, subtopics, competitions, or leaderboard, which previously only
-- existed because they were created by hand on the local dev database.

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    google_sub VARCHAR(255) DEFAULT NULL,
    public_email TINYINT(1) NOT NULL DEFAULT 0,
    bio TEXT,
    UNIQUE KEY username (username),
    UNIQUE KEY email (email),
    INDEX idx_users_google_sub (google_sub)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    UNIQUE INDEX idx_sessions_token_hash (token_hash),
    INDEX idx_sessions_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS password_reset_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    code_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_user_id (user_id),
    INDEX idx_password_reset_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS topics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    UNIQUE KEY name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS subtopics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    tags VARCHAR(100) DEFAULT NULL,
    INDEX topic_id (topic_id),
    CONSTRAINT subtopics_ibfk_1 FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS problem_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    tags VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    topic VARCHAR(255) DEFAULT NULL,
    subtopic VARCHAR(255) DEFAULT NULL,
    INDEX idx_problem_sets_name (name),
    INDEX idx_problem_sets_tags (tags)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS problem_set_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    topic VARCHAR(255) DEFAULT NULL,
    subtopic VARCHAR(255) DEFAULT NULL,
    tags VARCHAR(255) DEFAULT NULL,
    problems TEXT NOT NULL,
    submitter VARCHAR(255) DEFAULT NULL,
    status ENUM('pending', 'reviewed', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_suggestions_topic (topic),
    INDEX idx_suggestions_subtopic (subtopic),
    INDEX idx_suggestions_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS competitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    category VARCHAR(100) DEFAULT NULL,
    start_time TIME DEFAULT NULL,
    end_time TIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS leaderboard (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    score INT DEFAULT 0,
    solved_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX user_id (user_id),
    CONSTRAINT leaderboard_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = 1;
