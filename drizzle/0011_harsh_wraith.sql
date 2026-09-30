CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`order_number` varchar(64) NOT NULL,
	`placed_by_user_id` int,
	`placed_by_role` varchar(64) NOT NULL,
	`placed_by_name` varchar(191) NOT NULL,
	`school_id` int NOT NULL,
	`order_type` enum('STUDENT','STAFF') NOT NULL,
	`hook_type` varchar(64),
	`clip` boolean NOT NULL DEFAULT false,
	`class_name` varchar(64),
	`section` varchar(64),
	`quantity` int NOT NULL,
	`print_sides` enum('SINGLE','DOUBLE') NOT NULL,
	`card_material` enum('PVC_STANDARD','PVC_PREMIUM') NOT NULL,
	`lanyard_included` boolean NOT NULL DEFAULT false,
	`lanyard_color` varchar(64),
	`needed_by_date` varchar(32),
	`delivery_address` text,
	`contact_person` varchar(191),
	`contact_phone` varchar(32),
	`notes` text,
	`status` enum('PLACED','CONFIRMED','IN_PRODUCTION','DISPATCHED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'PLACED',
	`status_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE `removed_cards_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`id_card_id` int NOT NULL,
	`school_id` int NOT NULL,
	`card_number` varchar(64) NOT NULL,
	`student_name` varchar(191),
	`class_name` varchar(64),
	`section` varchar(64),
	`template_name` varchar(191),
	`previous_status` varchar(64) NOT NULL,
	`removed_by_user_id` int,
	`removed_by_name` varchar(191),
	`removed_by_role` varchar(64),
	`removed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `removed_cards_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('SUPER_ADMIN','SCHOOL_ADMIN','SCHOOL_OPERATOR','VIEWER','MARKETING_ADMIN') NOT NULL DEFAULT 'VIEWER';--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `actor_role` varchar(64);--> statement-breakpoint
ALTER TABLE `id_cards` ADD `removed_at` timestamp;--> statement-breakpoint
ALTER TABLE `id_cards` ADD `removed_by_user_id` int;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_placed_by_user_id_users_id_fk` FOREIGN KEY (`placed_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `removed_cards_history` ADD CONSTRAINT `removed_cards_history_id_card_id_id_cards_id_fk` FOREIGN KEY (`id_card_id`) REFERENCES `id_cards`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `removed_cards_history` ADD CONSTRAINT `removed_cards_history_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `removed_cards_history` ADD CONSTRAINT `removed_cards_history_removed_by_user_id_users_id_fk` FOREIGN KEY (`removed_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX `orders_school_idx` ON `orders` (`school_id`);--> statement-breakpoint
CREATE INDEX `orders_placed_by_idx` ON `orders` (`placed_by_user_id`);--> statement-breakpoint
CREATE INDEX `orders_status_idx` ON `orders` (`status`);--> statement-breakpoint
CREATE INDEX `orders_created_at_idx` ON `orders` (`created_at`);--> statement-breakpoint
CREATE INDEX `removed_cards_history_school_class_section_idx` ON `removed_cards_history` (`school_id`,`class_name`,`section`);--> statement-breakpoint
CREATE INDEX `removed_cards_history_removed_at_idx` ON `removed_cards_history` (`removed_at`);--> statement-breakpoint
ALTER TABLE `id_cards` ADD CONSTRAINT `id_cards_removed_by_user_id_users_id_fk` FOREIGN KEY (`removed_by_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE cascade;