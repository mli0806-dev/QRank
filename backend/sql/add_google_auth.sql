ALTER TABLE users
    ADD COLUMN google_sub VARCHAR(255) DEFAULT NULL,
    ADD INDEX idx_users_google_sub (google_sub);
