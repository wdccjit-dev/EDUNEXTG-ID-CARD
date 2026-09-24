CREATE TABLE `approval_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_card_id` int NOT NULL,
	`from_status` enum('DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUIRED','RESUBMITTED','APPROVED','REJECTED','PRINTED'),
	`to_status` enum('DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUIRED','RESUBMITTED','APPROVED','REJECTED','PRINTED') NOT NULL,
	`action` varchar(64) NOT NULL,
	`comments` text,
	`acted_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`school_id` int,
	`action` varchar(128) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` int,
	`old_values` json,
	`new_values` json,
	`ip_address` varchar(45),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `id_card_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_card_id` int NOT NULL,
	`field_key` varchar(64) NOT NULL,
	`field_value` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `id_card_data_id` PRIMARY KEY(`id`),
	CONSTRAINT `id_card_data_card_field_unique` UNIQUE(`id_card_id`,`field_key`)
);
--> statement-breakpoint
CREATE TABLE `id_card_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_card_id` int NOT NULL,
	`file_type` varchar(32) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`file_url` text NOT NULL,
	`mime_type` varchar(128),
	`file_size` int,
	`uploaded_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `id_card_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `id_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`school_id` int NOT NULL,
	`template_id` int NOT NULL,
	`request_id` int,
	`card_number` varchar(64) NOT NULL,
	`status` enum('DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUIRED','RESUBMITTED','APPROVED','REJECTED','PRINTED') NOT NULL DEFAULT 'DRAFT',
	`submitted_by_user_id` int,
	`approved_by_user_id` int,
	`printed_at` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `id_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `id_cards_school_card_number_unique` UNIQUE(`school_id`,`card_number`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`school_id` int,
	`type` varchar(64) NOT NULL,
	`title` varchar(191) NOT NULL,
	`message` text NOT NULL,
	`entity_type` varchar(64),
	`entity_id` int,
	`is_read` boolean NOT NULL DEFAULT false,
	`read_at` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `password_resets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `password_resets_id` PRIMARY KEY(`id`),
	CONSTRAINT `password_resets_token_hash_unique` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `school_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`school_id` int NOT NULL,
	`user_id` int NOT NULL,
	`permission` varchar(64) NOT NULL,
	`granted_by_user_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_permissions_school_user_permission_unique` UNIQUE(`school_id`,`user_id`,`permission`)
);
--> statement-breakpoint
CREATE TABLE `school_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`school_id` int NOT NULL,
	`template_id` int NOT NULL,
	`assigned_by_user_id` int,
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `school_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `school_templates_school_template_unique` UNIQUE(`school_id`,`template_id`)
);
--> statement-breakpoint
CREATE TABLE `template_elements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`template_id` int NOT NULL,
	`element_key` varchar(64) NOT NULL,
	`element_type` varchar(32) NOT NULL,
	`label` varchar(191),
	`config` json,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `template_elements_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_elements_template_key_unique` UNIQUE(`template_id`,`element_key`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','SUPER_ADMIN','SCHOOL_ADMIN','SCHOOL_OPERATOR','VIEWER') NOT NULL DEFAULT 'VIEWER';
--> statement-breakpoint
ALTER TABLE `idCardTemplates` MODIFY COLUMN `status` enum('active','draft','DRAFT','ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT';
--> statement-breakpoint
ALTER TABLE `idCardRequests` MODIFY COLUMN `status` enum('pending','approved','changes_requested','DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUIRED','RESUBMITTED','APPROVED','REJECTED','PRINTED') NOT NULL DEFAULT 'DRAFT';
--> statement-breakpoint
UPDATE `users` SET `role` = 'SUPER_ADMIN' WHERE `role` = 'admin';
--> statement-breakpoint
UPDATE `users` SET `role` = 'VIEWER' WHERE `role` = 'user';
--> statement-breakpoint
UPDATE `idCardTemplates` SET `status` = 'ACTIVE' WHERE `status` = 'active';
--> statement-breakpoint
UPDATE `idCardTemplates` SET `status` = 'DRAFT' WHERE `status` = 'draft';
--> statement-breakpoint
UPDATE `idCardRequests` SET `status` = 'APPROVED' WHERE `status` = 'approved';
--> statement-breakpoint
UPDATE `idCardRequests` SET `status` = 'CHANGES_REQUIRED' WHERE `status` = 'changes_requested';
--> statement-breakpoint
UPDATE `idCardRequests` SET `status` = 'SUBMITTED' WHERE `status` = 'pending';
--> statement-breakpoint
ALTER TABLE `idCardRequests` DROP FOREIGN KEY `idCardRequests_schoolId_schools_id_fk`;
--> statement-breakpoint
ALTER TABLE `idCardRequests` MODIFY COLUMN `status` enum('DRAFT','SUBMITTED','UNDER_REVIEW','CHANGES_REQUIRED','RESUBMITTED','APPROVED','REJECTED','PRINTED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `idCardRequests` MODIFY COLUMN `submittedAt` timestamp NULL;--> statement-breakpoint
ALTER TABLE `idCardTemplates` MODIFY COLUMN `status` enum('DRAFT','ACTIVE','INACTIVE','ARCHIVED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('SUPER_ADMIN','SCHOOL_ADMIN','SCHOOL_OPERATOR','VIEWER') NOT NULL DEFAULT 'VIEWER';--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD `requestedByUserId` int;--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD `reviewedByUserId` int;--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD `templateId` int;--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD `createdAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `idCardTemplates` ADD `description` text;--> statement-breakpoint
ALTER TABLE `idCardTemplates` ADD `createdByUserId` int;--> statement-breakpoint
ALTER TABLE `idCardTemplates` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `schools` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `schools` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `schools` ADD `address` text;--> statement-breakpoint
ALTER TABLE `schools` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `schools` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD `schoolId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD CONSTRAINT `idCardRequests_school_admission_unique` UNIQUE(`schoolId`,`admissionCode`);--> statement-breakpoint
ALTER TABLE `approval_history` ADD CONSTRAINT `approval_history_id_card_id_id_cards_id_fk` FOREIGN KEY (`id_card_id`) REFERENCES `id_cards`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `approval_history` ADD CONSTRAINT `approval_history_acted_by_user_id_users_id_fk` FOREIGN KEY (`acted_by_user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `id_card_data` ADD CONSTRAINT `id_card_data_id_card_id_id_cards_id_fk` FOREIGN KEY (`id_card_id`) REFERENCES `id_cards`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `id_card_files` ADD CONSTRAINT `id_card_files_id_card_id_id_cards_id_fk` FOREIGN KEY (`id_card_id`) REFERENCES `id_cards`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `id_card_files` ADD CONSTRAINT `id_card_files_uploaded_by_user_id_users_id_fk` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `id_cards` ADD CONSTRAINT `id_cards_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `id_cards` ADD CONSTRAINT `id_cards_template_id_idCardTemplates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `idCardTemplates`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `id_cards` ADD CONSTRAINT `id_cards_request_id_idCardRequests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `idCardRequests`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `id_cards` ADD CONSTRAINT `id_cards_submitted_by_user_id_users_id_fk` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `id_cards` ADD CONSTRAINT `id_cards_approved_by_user_id_users_id_fk` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `password_resets` ADD CONSTRAINT `password_resets_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `school_permissions` ADD CONSTRAINT `school_permissions_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `school_permissions` ADD CONSTRAINT `school_permissions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `school_permissions` ADD CONSTRAINT `school_permissions_granted_by_user_id_users_id_fk` FOREIGN KEY (`granted_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `school_templates` ADD CONSTRAINT `school_templates_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `school_templates` ADD CONSTRAINT `school_templates_template_id_idCardTemplates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `idCardTemplates`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `school_templates` ADD CONSTRAINT `school_templates_assigned_by_user_id_users_id_fk` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `template_elements` ADD CONSTRAINT `template_elements_template_id_idCardTemplates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `idCardTemplates`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `approval_history_card_idx` ON `approval_history` (`id_card_id`);--> statement-breakpoint
CREATE INDEX `approval_history_actor_idx` ON `approval_history` (`acted_by_user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_school_created_idx` ON `audit_logs` (`school_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `id_card_data_card_idx` ON `id_card_data` (`id_card_id`);--> statement-breakpoint
CREATE INDEX `id_card_files_card_idx` ON `id_card_files` (`id_card_id`);--> statement-breakpoint
CREATE INDEX `id_card_files_type_idx` ON `id_card_files` (`file_type`);--> statement-breakpoint
CREATE INDEX `id_cards_school_status_idx` ON `id_cards` (`school_id`,`status`);--> statement-breakpoint
CREATE INDEX `id_cards_request_idx` ON `id_cards` (`request_id`);--> statement-breakpoint
CREATE INDEX `notifications_user_read_idx` ON `notifications` (`user_id`,`is_read`);--> statement-breakpoint
CREATE INDEX `notifications_school_idx` ON `notifications` (`school_id`);--> statement-breakpoint
CREATE INDEX `password_resets_user_idx` ON `password_resets` (`user_id`);--> statement-breakpoint
CREATE INDEX `password_resets_expires_idx` ON `password_resets` (`expires_at`);--> statement-breakpoint
CREATE INDEX `school_permissions_user_idx` ON `school_permissions` (`user_id`);--> statement-breakpoint
CREATE INDEX `school_templates_school_idx` ON `school_templates` (`school_id`);--> statement-breakpoint
CREATE INDEX `template_elements_template_idx` ON `template_elements` (`template_id`);--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD CONSTRAINT `idCardRequests_requestedByUserId_users_id_fk` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD CONSTRAINT `idCardRequests_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD CONSTRAINT `idCardRequests_templateId_idCardTemplates_id_fk` FOREIGN KEY (`templateId`) REFERENCES `idCardTemplates`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `idCardRequests` ADD CONSTRAINT `idCardRequests_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `idCardTemplates` ADD CONSTRAINT `idCardTemplates_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `idCardRequests_schoolId_idx` ON `idCardRequests` (`schoolId`);--> statement-breakpoint
CREATE INDEX `idCardRequests_status_idx` ON `idCardRequests` (`status`);--> statement-breakpoint
CREATE INDEX `idCardTemplates_status_idx` ON `idCardTemplates` (`status`);--> statement-breakpoint
CREATE INDEX `idCardTemplates_createdByUserId_idx` ON `idCardTemplates` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `users_schoolId_idx` ON `users` (`schoolId`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);
