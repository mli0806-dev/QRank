CREATE TABLE IF NOT EXISTS problems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    problem_set_id INT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    type ENUM('multiple_choice', 'free_response') NOT NULL,
    prompt TEXT NOT NULL,
    choices JSON DEFAULT NULL,
    answer VARCHAR(500) NOT NULL,
    CONSTRAINT fk_problems_problem_set FOREIGN KEY (problem_set_id) REFERENCES problem_sets(id) ON DELETE CASCADE,
    INDEX idx_problems_problem_set (problem_set_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
