CREATE DATABASE IF NOT EXISTS `eduvoice`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `eduvoice`;

CREATE TABLE IF NOT EXISTS `departments` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_departments_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `student_id` VARCHAR(50) NULL,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('student', 'staff', 'admin') NOT NULL DEFAULT 'student',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `department_id` INT UNSIGNED NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_student_id` (`student_id`),
    UNIQUE KEY `uq_users_email` (`email`),
    KEY `ix_users_department_id` (`department_id`),
    CONSTRAINT `fk_users_department`
        FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `categories` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_categories_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feedback` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `category_id` INT UNSIGNED NULL,
    `type` ENUM('feedback', 'suggestion') NOT NULL DEFAULT 'feedback',
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `is_anonymous` TINYINT(1) NOT NULL DEFAULT 0,
    `priority` ENUM('Low', 'Normal', 'High', 'Urgent') NOT NULL DEFAULT 'Normal',
    `department_id` INT UNSIGNED NULL,
    `resolution_notes` TEXT NULL,
    `status` ENUM(
        'Pending',
        'Under Review',
        'In Progress',
        'Resolved',
        'Rejected'
    ) NOT NULL DEFAULT 'Pending',
    `assigned_to` INT UNSIGNED NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_feedback_user_id` (`user_id`),
    KEY `ix_feedback_category_id` (`category_id`),
    KEY `ix_feedback_type` (`type`),
    KEY `ix_feedback_status` (`status`),
    KEY `ix_feedback_assigned_to` (`assigned_to`),
    KEY `ix_feedback_department_id` (`department_id`),
    KEY `ix_feedback_priority` (`priority`),
    CONSTRAINT `fk_feedback_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_feedback_category`
        FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_feedback_assigned_to`
        FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_feedback_department`
        FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feedback_responses` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `feedback_id` INT UNSIGNED NOT NULL,
    `admin_id` INT UNSIGNED NOT NULL,
    `response` TEXT NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_feedback_responses_feedback_id` (`feedback_id`),
    KEY `ix_feedback_responses_admin_id` (`admin_id`),
    CONSTRAINT `fk_feedback_responses_feedback`
        FOREIGN KEY (`feedback_id`) REFERENCES `feedback` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_feedback_responses_admin`
        FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `feedback_attachments` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `feedback_id` INT UNSIGNED NOT NULL,
    `uploader_id` INT UNSIGNED NOT NULL,
    `storage_key` VARCHAR(80) NOT NULL,
    `original_name` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size_bytes` INT UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_feedback_attachments_storage_key` (`storage_key`),
    KEY `ix_feedback_attachments_feedback_id` (`feedback_id`),
    CONSTRAINT `fk_feedback_attachments_feedback`
        FOREIGN KEY (`feedback_id`) REFERENCES `feedback` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_feedback_attachments_uploader`
        FOREIGN KEY (`uploader_id`) REFERENCES `users` (`id`)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `feedback_id` INT UNSIGNED NULL,
    `event_type` VARCHAR(40) NOT NULL,
    `title` VARCHAR(150) NOT NULL,
    `message` VARCHAR(500) NOT NULL,
    `read_at` TIMESTAMP NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_notifications_user_unread` (`user_id`, `read_at`, `created_at`),
    KEY `ix_notifications_feedback_id` (`feedback_id`),
    CONSTRAINT `fk_notifications_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_notifications_feedback`
        FOREIGN KEY (`feedback_id`) REFERENCES `feedback` (`id`)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `actor_user_id` INT UNSIGNED NULL,
    `action` VARCHAR(60) NOT NULL,
    `entity_type` VARCHAR(40) NOT NULL,
    `entity_id` BIGINT UNSIGNED NULL,
    `details` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `ix_audit_logs_actor` (`actor_user_id`, `created_at`),
    KEY `ix_audit_logs_entity` (`entity_type`, `entity_id`, `created_at`),
    CONSTRAINT `fk_audit_logs_actor`
        FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `departments` (`name`)
VALUES ('Academic Affairs'), ('Facilities'), ('IT Services'), ('Student Services');

INSERT IGNORE INTO `categories` (`name`)
VALUES
    ('Academic'),
    ('Campus Environment'),
    ('Facilities'),
    ('Other'),
    ('Student Services'),
    ('Teachers/Faculty'),
    ('Technology');
