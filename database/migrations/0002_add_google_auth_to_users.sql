-- Plain `ADD COLUMN IF NOT EXISTS` / `ADD INDEX IF NOT EXISTS` is a MariaDB
-- extension, not standard MySQL syntax -- it fails on real MySQL servers
-- (verified against 9.6.0). This prepared-statement pattern is the portable
-- way to make an ALTER TABLE conditional on standard MySQL.
SET @columnExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'google_sub'
);
SET @ddl = IF(@columnExists = 0,
    'ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) DEFAULT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @indexExists = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_google_sub'
);
SET @ddl = IF(@indexExists = 0,
    'ALTER TABLE users ADD INDEX idx_users_google_sub (google_sub)',
    'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
