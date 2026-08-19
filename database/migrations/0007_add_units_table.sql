CREATE TABLE IF NOT EXISTS units (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subtopic_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    CONSTRAINT fk_units_subtopic FOREIGN KEY (subtopic_id) REFERENCES subtopics(id) ON DELETE CASCADE,
    INDEX idx_units_subtopic (subtopic_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
