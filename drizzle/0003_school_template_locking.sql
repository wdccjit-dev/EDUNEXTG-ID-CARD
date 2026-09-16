ALTER TABLE `school_templates` ADD `is_locked` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `school_templates` ADD `locked_at` timestamp;--> statement-breakpoint
ALTER TABLE `school_templates` ADD `locked_by_user_id` int;--> statement-breakpoint
ALTER TABLE `school_templates` ADD CONSTRAINT `school_templates_locked_by_user_id_users_id_fk` FOREIGN KEY (`locked_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `school_templates_locked_idx` ON `school_templates` (`school_id`,`is_locked`);