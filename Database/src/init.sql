-- ============================================================
--  TempsFlow — Database Schema
--  MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS tempsflow
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tempsflow;

-- ============================================================
--  TABLE: users
-- ============================================================
CREATE TABLE users (
  id            INT           NOT NULL AUTO_INCREMENT,
  username      VARCHAR(100)  NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  first_name    VARCHAR(100)  NOT NULL,
  last_name     VARCHAR(100)  NOT NULL,
  role          ENUM('employee', 'admin') NOT NULL DEFAULT 'employee',
  contract_hours INT          NOT NULL DEFAULT 0,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
);

-- ============================================================
--  TABLE: shifts
-- ============================================================
CREATE TABLE shifts (
  id            INT       NOT NULL AUTO_INCREMENT,
  user_id       INT       NOT NULL,
  work_date     DATE      NOT NULL,
  clock_in      DATETIME  NOT NULL,
  clock_out     DATETIME  NULL,
  worked_hours  INT       NULL COMMENT 'Total worked time in minutes',
  created_at    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_shifts_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ============================================================
--  TABLE: correction_requests
-- ============================================================
CREATE TABLE correction_requests (
  id               INT       NOT NULL AUTO_INCREMENT,
  user_id          INT       NOT NULL,
  request_date     DATE      NOT NULL,
  correction_type  ENUM('forgot_clock_in', 'forgot_clock_out') NOT NULL,
  requested_time   TIME      NOT NULL,
  reason           TEXT      NULL,
  status           ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by      INT       NULL COMMENT 'Admin user id who reviewed',
  reviewed_at      DATETIME  NULL,
  created_at       DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  CONSTRAINT fk_correction_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_correction_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- ============================================================
--  INDEXES
-- ============================================================

-- Speed up shift lookups by user and date
CREATE INDEX idx_shifts_user_id   ON shifts (user_id);
CREATE INDEX idx_shifts_work_date ON shifts (work_date);

-- Speed up correction lookups by user and status
CREATE INDEX idx_corrections_user_id ON correction_requests (user_id);
CREATE INDEX idx_corrections_status  ON correction_requests (status);


-- Admin account: Password: admin123
INSERT INTO users (username, password_hash, first_name, last_name, role)
VALUES ('Admin', '$2a$12$lbZLfr5GfZ6WsFTFbYHuxu0SOOJiiJ8nrZRNcxlUmpR3PXBwlrIdC', 'Admin', 'TempsFlow', 'admin');








