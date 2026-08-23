CREATE TABLE IF NOT EXISTS saved_competitions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    competition_id INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_user_competition (user_id, competition_id),
    INDEX idx_saved_competitions_user (user_id),
    CONSTRAINT fk_saved_competitions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_saved_competitions_competition FOREIGN KEY (competition_id) REFERENCES competitions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
