CREATE TABLE IF NOT EXISTS problem_sets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    topic VARCHAR(255) DEFAULT NULL,
    subtopic VARCHAR(255) DEFAULT NULL,
    tags VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_problem_sets_name (name),
    INDEX idx_problem_sets_topic (topic),
    INDEX idx_problem_sets_subtopic (subtopic),
    INDEX idx_problem_sets_tags (tags)
);
