SET @is_tidb = (SELECT VERSION() LIKE '%TiDB%');
SET @tableExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'topic_resources'
);
SET @ddl = IF(@tableExists > 0, 'SELECT 1', IF(@is_tidb,
    'CREATE TABLE topic_resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        topic_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        url VARCHAR(500) NOT NULL,
        description VARCHAR(300) DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_topic_resources_topic (topic_id),
        CONSTRAINT fk_topic_resources_topic FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE,
        CONSTRAINT fk_topic_resources_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci AUTO_ID_CACHE=1',
    'CREATE TABLE topic_resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        topic_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        url VARCHAR(500) NOT NULL,
        description VARCHAR(300) DEFAULT NULL,
        created_by INT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_topic_resources_topic (topic_id),
        CONSTRAINT fk_topic_resources_topic FOREIGN KEY (topic_id) REFERENCES topics (id) ON DELETE CASCADE,
        CONSTRAINT fk_topic_resources_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
));
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
