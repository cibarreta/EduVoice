-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 24, 2026 at 03:20 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `eduvoice`
--

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `actor_user_id` int(10) UNSIGNED DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `entity_type` varchar(40) NOT NULL,
  `entity_id` bigint(20) UNSIGNED DEFAULT NULL,
  `details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`details`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`) VALUES
(1, 2, 'submission.created', 'feedback', 1, '{\"type\":\"feedback\",\"priority\":\"Normal\",\"attachmentCount\":0}', '2026-10-05 12:43:02'),
(2, 3, 'feedback.claimed', 'feedback', 1, '{\"departmentId\":null}', '2026-10-05 12:44:44'),
(3, 3, 'feedback.updated', 'feedback', 1, '{\"statusFrom\":\"Pending\",\"statusTo\":\"Under Review\",\"resolutionNotesUpdated\":false}', '2026-10-05 12:44:44'),
(4, 4, 'user.deactivated', 'user', 1, '{\"isActive\":false}', '2026-10-05 12:52:58'),
(5, 4, 'user.activated', 'user', 1, '{\"isActive\":true}', '2026-10-05 12:53:20'),
(6, 8, 'submission.created', 'feedback', 2, '{\"type\":\"feedback\",\"priority\":\"High\",\"attachmentCount\":0}', '2026-10-20 23:37:26'),
(7, 3, 'feedback.claimed', 'feedback', 2, '{\"departmentId\":null}', '2026-10-20 23:40:26'),
(8, 3, 'feedback.updated', 'feedback', 2, '{\"statusFrom\":\"Pending\",\"statusTo\":\"Under Review\",\"resolutionNotesUpdated\":false}', '2026-10-20 23:40:26'),
(9, 3, 'feedback.response_added', 'feedback', 2, '{\"responseLength\":24}', '2026-10-20 23:41:02'),
(10, 2, 'submission.created', 'feedback', 3, '{\"type\":\"suggestion\",\"priority\":\"Normal\",\"attachmentCount\":1}', '2026-10-22 04:22:54'),
(11, 3, 'feedback.claimed', 'feedback', 3, '{\"departmentId\":null}', '2026-11-22 05:11:50'),
(12, 3, 'feedback.updated', 'feedback', 3, '{\"statusFrom\":\"Pending\",\"statusTo\":\"Pending\",\"resolutionNotesUpdated\":true}', '2026-11-22 05:12:11'),
(13, 3, 'feedback.updated', 'feedback', 3, '{\"statusFrom\":\"Pending\",\"statusTo\":\"Resolved\",\"resolutionNotesUpdated\":true}', '2026-11-23 03:53:40');

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

CREATE TABLE `categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `name`) VALUES
(1, 'Academic'),
(2, 'Campus Environment'),
(3, 'Facilities'),
(4, 'Other'),
(5, 'Student Services'),
(6, 'Teachers/Faculty'),
(7, 'Technology');

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`id`, `name`, `created_at`) VALUES
(1, 'Academic Affairs', '2026-10-05 12:28:45'),
(2, 'Facilities', '2026-10-05 12:28:45'),
(3, 'IT Services', '2026-10-05 12:28:45'),
(4, 'Student Services', '2026-10-05 12:28:45'),
(5, 'College of Computer Studies', '2026-10-22 03:50:08'),
(6, 'College of Health Sciences', '2026-10-22 03:50:08'),
(7, 'College of Engineering and Architecture', '2026-10-22 03:50:08'),
(8, 'College of Arts and Sciences', '2026-10-22 03:50:08'),
(9, 'College of Technological and Developmental Education', '2026-10-22 03:50:08'),
(10, 'College of Tourism, Hospitality and Business Management', '2026-10-22 03:50:08'),
(11, 'Buhi Campus', '2026-10-22 03:50:08');

-- --------------------------------------------------------

--
-- Table structure for table `feedback`
--

CREATE TABLE `feedback` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED DEFAULT NULL,
  `type` enum('feedback','suggestion') NOT NULL DEFAULT 'feedback',
  `title` varchar(200) NOT NULL,
  `description` text NOT NULL,
  `is_anonymous` tinyint(1) NOT NULL DEFAULT 0,
  `priority` enum('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  `department_id` int(10) UNSIGNED DEFAULT NULL,
  `resolution_notes` text DEFAULT NULL,
  `status` enum('Pending','Under Review','In Progress','Resolved','Rejected') NOT NULL DEFAULT 'Pending',
  `assigned_to` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `student_department_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `feedback`
--

INSERT INTO `feedback` (`id`, `user_id`, `category_id`, `type`, `title`, `description`, `is_anonymous`, `priority`, `department_id`, `resolution_notes`, `status`, `assigned_to`, `created_at`, `updated_at`, `student_department_id`) VALUES
(1, 2, 7, 'feedback', 'the PC has no internet connection', 'aljhjhabdcadjfk', 1, 'Normal', NULL, NULL, 'Under Review', 3, '2026-10-05 12:43:02', '2026-10-05 12:44:44', NULL),
(2, 8, 7, 'feedback', 'Slow Internet Connection', 'The PC 12 in IT LAB 1 has no internet connection', 0, 'High', NULL, NULL, 'Under Review', 3, '2026-10-20 23:37:26', '2026-10-20 23:40:26', NULL),
(3, 2, 7, 'suggestion', 'hello', 'HKADKJAKSHERHKAD', 1, 'Normal', NULL, 'its already solved', 'Resolved', 3, '2026-10-22 04:22:54', '2026-11-23 03:53:40', 5);

-- --------------------------------------------------------

--
-- Table structure for table `feedback_attachments`
--

CREATE TABLE `feedback_attachments` (
  `id` int(10) UNSIGNED NOT NULL,
  `feedback_id` int(10) UNSIGNED NOT NULL,
  `uploader_id` int(10) UNSIGNED NOT NULL,
  `storage_key` varchar(80) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `mime_type` varchar(100) NOT NULL,
  `size_bytes` int(10) UNSIGNED NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `feedback_attachments`
--

INSERT INTO `feedback_attachments` (`id`, `feedback_id`, `uploader_id`, `storage_key`, `original_name`, `mime_type`, `size_bytes`, `created_at`) VALUES
(1, 3, 2, '83dac867-b1ac-4be0-8957-eaa4b6863d07.jpg', '7746f21eaa3410db13ac094b64515066.jpg', 'image/jpeg', 102361, '2026-10-22 04:22:54');

-- --------------------------------------------------------

--
-- Table structure for table `feedback_responses`
--

CREATE TABLE `feedback_responses` (
  `id` int(10) UNSIGNED NOT NULL,
  `feedback_id` int(10) UNSIGNED NOT NULL,
  `admin_id` int(10) UNSIGNED NOT NULL,
  `response` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `feedback_responses`
--

INSERT INTO `feedback_responses` (`id`, `feedback_id`, `admin_id`, `response`, `created_at`) VALUES
(1, 2, 3, 'it is under review na po', '2026-10-20 23:41:02');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `feedback_id` int(10) UNSIGNED DEFAULT NULL,
  `event_type` varchar(40) NOT NULL,
  `title` varchar(150) NOT NULL,
  `message` varchar(500) NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `feedback_id`, `event_type`, `title`, `message`, `read_at`, `created_at`) VALUES
(1, 4, 1, 'submission_created', 'New submission', 'A new feedback submission (#1) is ready for review.', '2026-10-05 12:48:41', '2026-10-05 12:43:02'),
(2, 2, 1, 'status_updated', 'Submission status updated', 'Your submission #1 is now Under Review.', '2026-11-22 05:59:15', '2026-10-05 12:44:44'),
(3, 4, 2, 'submission_created', 'New submission', 'A new feedback submission (#2) is ready for review.', NULL, '2026-10-20 23:37:26'),
(4, 8, 2, 'status_updated', 'Submission status updated', 'Your submission #2 is now Under Review.', NULL, '2026-10-20 23:40:26'),
(5, 8, 2, 'response_added', 'You received a response', 'A staff member responded to your submission #2.', NULL, '2026-10-20 23:41:02'),
(6, 4, 3, 'submission_created', 'New submission', 'A new suggestion submission (#3) is ready for review.', NULL, '2026-10-22 04:22:54'),
(7, 2, 3, 'status_updated', 'Submission status updated', 'Your submission #3 is now Pending.', '2026-11-22 05:59:15', '2026-11-22 05:12:11'),
(8, 2, 3, 'status_updated', 'Submission status updated', 'Your submission #3 is now Resolved.', '2026-11-23 03:54:12', '2026-11-23 03:53:40');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `session_id` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) UNSIGNED NOT NULL,
  `data` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`session_id`, `expires`, `data`) VALUES
('84pgDvYPCMoOszaKBpncKkIqYiqBCqOk', 1795369193, '{\"cookie\":{\"originalMaxAge\":43200000,\"expires\":\"2026-11-22T17:39:53.253Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"user\":{\"id\":2,\"name\":\"Demo Student\",\"email\":\"student.demo@my.cspc.edu.ph\",\"role\":\"student\"},\"csrfToken\":\"7f12999d5deede8561cbfb6d4efe8767ab540f4fb8d01f2aed0abdeb5c5c0f3c\"}'),
('O3ah1SveSkP6C1uQ-YrCA4VtxAvmnrXF', 1795369513, '{\"cookie\":{\"originalMaxAge\":43200000,\"expires\":\"2026-11-22T17:45:10.705Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"user\":{\"id\":2,\"name\":\"Demo Student\",\"email\":\"student.demo@my.cspc.edu.ph\",\"role\":\"student\"},\"csrfToken\":\"965d90450e91648d6a1bfcf26b91f56718a346b76ca8046d58ff14f5d5864cea\"}'),
('OMYU-NlvX0jfe6Pyuroz5SSgb40LS9Df', 1795449269, '{\"cookie\":{\"originalMaxAge\":43200000,\"expires\":\"2026-11-23T15:54:29.408Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"user\":{\"id\":4,\"name\":\"Admin\",\"email\":\"admin.demo@my.cspc.edu.ph\",\"role\":\"admin\"},\"csrfToken\":\"17ae635576263f02e54089fe1e5fe54a5a332d7a99077602c7aaee703771990e\"}'),
('hf2A0puk9JgNZfRkQCtRS9yH3q2MLezZ', 1795370254, '{\"cookie\":{\"originalMaxAge\":43200000,\"expires\":\"2026-11-22T17:56:08.323Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"csrfToken\":\"977fb59fa554ae53cd1cb095d74b5c92f8cfe33e5401a00dd08d3bf3c40e4b0a\"}'),
('jxI4EIfDTjXwji4qE1OGcgFvARpiHlZX', 1795369981, '{\"cookie\":{\"originalMaxAge\":43200000,\"expires\":\"2026-11-22T17:52:58.085Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"user\":{\"id\":2,\"name\":\"Demo Student\",\"email\":\"student.demo@my.cspc.edu.ph\",\"role\":\"student\"},\"csrfToken\":\"a206f4b789e7bee016c7f698ecdff2846d333e76701c77a203a09c511daccb8c\"}'),
('vp-GHSfeiJkWsP1pIEKMMrkSDeNbiQrR', 1795370411, '{\"cookie\":{\"originalMaxAge\":43200000,\"expires\":\"2026-11-22T18:00:11.178Z\",\"secure\":false,\"httpOnly\":true,\"path\":\"/\",\"sameSite\":\"lax\"},\"csrfToken\":\"4cb636e7951734aba6e086020d427beb651fc9871db2282a302b5a9b687a1dd9\"}');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `student_id` varchar(50) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `email` varchar(254) NOT NULL,
  `password` varchar(255) NOT NULL,
  `role` enum('student','staff','admin') NOT NULL DEFAULT 'student',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `department_id` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `student_id`, `name`, `email`, `password`, `role`, `is_active`, `department_id`, `created_at`, `updated_at`) VALUES
(2, 'Student', 'Student A', 'student.demo@my.cspc.edu.ph', '$2b$12$XvqccDm7G0jZ7N0yQ9V7YerHJz.NyX.eIFC2fMLdqMFUIZMUW1T/y', 'student', 1, NULL, '2026-10-05 12:36:38', '2026-11-22 06:00:01'),
(3, NULL, 'Staff', 'staff.demo@my.cspc.edu.ph', '$2b$12$XvqccDm7G0jZ7N0yQ9V7YerHJz.NyX.eIFC2fMLdqMFUIZMUW1T/y', 'staff', 1, NULL, '2026-10-05 12:36:38', '2026-10-05 12:37:42'),
(4, NULL, 'Admin', 'admin.demo@my.cspc.edu.ph', '$2b$12$XvqccDm7G0jZ7N0yQ9V7YerHJz.NyX.eIFC2fMLdqMFUIZMUW1T/y', 'admin', 1, NULL, '2026-10-05 12:36:38', '2026-10-05 12:37:42'),
(8, '2410963', 'Clarize Ibarreta', 'clibarreta@my.cspc.edu.ph', '$2b$12$C0lvzlJ6WI2D7gy/WRgkseo9bYoyR72cMZCTofZVAoBZ1URhmJqFy', 'student', 1, NULL, '2026-10-20 23:34:41', '2026-10-20 23:34:41');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_audit_logs_actor` (`actor_user_id`,`created_at`),
  ADD KEY `ix_audit_logs_entity` (`entity_type`,`entity_id`,`created_at`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_categories_name` (`name`);

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_departments_name` (`name`);

--
-- Indexes for table `feedback`
--
ALTER TABLE `feedback`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_feedback_user_id` (`user_id`),
  ADD KEY `ix_feedback_category_id` (`category_id`),
  ADD KEY `ix_feedback_type` (`type`),
  ADD KEY `ix_feedback_status` (`status`),
  ADD KEY `ix_feedback_assigned_to` (`assigned_to`),
  ADD KEY `ix_feedback_department_id` (`department_id`),
  ADD KEY `ix_feedback_priority` (`priority`),
  ADD KEY `ix_feedback_student_department_id` (`student_department_id`);

--
-- Indexes for table `feedback_attachments`
--
ALTER TABLE `feedback_attachments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_feedback_attachments_storage_key` (`storage_key`),
  ADD KEY `ix_feedback_attachments_feedback_id` (`feedback_id`),
  ADD KEY `fk_feedback_attachments_uploader` (`uploader_id`);

--
-- Indexes for table `feedback_responses`
--
ALTER TABLE `feedback_responses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_feedback_responses_feedback_id` (`feedback_id`),
  ADD KEY `ix_feedback_responses_admin_id` (`admin_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `ix_notifications_user_unread` (`user_id`,`read_at`,`created_at`),
  ADD KEY `ix_notifications_feedback_id` (`feedback_id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`session_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_email` (`email`),
  ADD UNIQUE KEY `uq_users_student_id` (`student_id`),
  ADD KEY `ix_users_department_id` (`department_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
 MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `feedback`
--
ALTER TABLE `feedback`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `feedback_attachments`
--
ALTER TABLE `feedback_attachments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `feedback_responses`
--
ALTER TABLE `feedback_responses`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_audit_logs_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `feedback`
--
ALTER TABLE `feedback`
  ADD CONSTRAINT `fk_feedback_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_feedback_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_feedback_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_feedback_student_department` FOREIGN KEY (`student_department_id`) REFERENCES `departments` (`id`),
  ADD CONSTRAINT `fk_feedback_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `feedback_attachments`
--
ALTER TABLE `feedback_attachments`
  ADD CONSTRAINT `fk_feedback_attachments_feedback` FOREIGN KEY (`feedback_id`) REFERENCES `feedback` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_feedback_attachments_uploader` FOREIGN KEY (`uploader_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `feedback_responses`
--
ALTER TABLE `feedback_responses`
  ADD CONSTRAINT `fk_feedback_responses_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_feedback_responses_feedback` FOREIGN KEY (`feedback_id`) REFERENCES `feedback` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_feedback` FOREIGN KEY (`feedback_id`) REFERENCES `feedback` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` INT UNSIGNED NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_password_reset_tokens_hash` (`token_hash`),
    KEY `ix_password_reset_tokens_user` (`user_id`),
    KEY `ix_password_reset_tokens_expiry` (`expires_at`),
    CONSTRAINT `fk_password_reset_tokens_user`
        FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;