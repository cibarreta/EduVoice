CREATE DATABASE IF NOT EXISTS `eduvoice`
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE `eduvoice`;

CREATE TABLE IF NOT EXISTS `users` (
    `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `student_id` VARCHAR(50) NULL,
    `name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(254) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `role` ENUM('student', 'staff', 'admin') NOT NULL DEFAULT 'student',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_users_student_id` (`student_id`),
    UNIQUE KEY `uq_users_email` (`email`)
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
    CONSTRAINT `fk_feedback_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_feedback_category`
        FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
        ON DELETE SET NULL,
    CONSTRAINT `fk_feedback_assigned_to`
        FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`)
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

INSERT IGNORE INTO `categories` (`name`)
VALUES ('Academic'), ('Facilities'), ('Student Services'), ('Other');
