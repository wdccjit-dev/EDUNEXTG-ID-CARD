CREATE TABLE IF NOT EXISTS `orders` (
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
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_order_number_unique` UNIQUE(`order_number`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `removed_cards_history` (
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
	`removed_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `removed_cards_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('SUPER_ADMIN','SCHOOL_ADMIN','SCHOOL_OPERATOR','VIEWER','MARKETING_ADMIN') NOT NULL DEFAULT 'VIEWER';
--> statement-breakpoint
SET @audit_logs_actor_role_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = DATABASE() AND table_name = 'audit_logs' AND column_name = 'actor_role'
  ),
  'SELECT 1',
  'ALTER TABLE `audit_logs` ADD COLUMN `actor_role` varchar(64) NULL'
);
--> statement-breakpoint
PREPARE stmt_audit_logs_actor_role FROM @audit_logs_actor_role_sql;
--> statement-breakpoint
EXECUTE stmt_audit_logs_actor_role;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_audit_logs_actor_role;
--> statement-breakpoint
SET @id_cards_removed_at_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = DATABASE() AND table_name = 'id_cards' AND column_name = 'removed_at'
  ),
  'SELECT 1',
  'ALTER TABLE `id_cards` ADD COLUMN `removed_at` timestamp NULL'
);
--> statement-breakpoint
PREPARE stmt_id_cards_removed_at FROM @id_cards_removed_at_sql;
--> statement-breakpoint
EXECUTE stmt_id_cards_removed_at;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_id_cards_removed_at;
--> statement-breakpoint
SET @id_cards_removed_by_user_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = DATABASE() AND table_name = 'id_cards' AND column_name = 'removed_by_user_id'
  ),
  'SELECT 1',
  'ALTER TABLE `id_cards` ADD COLUMN `removed_by_user_id` int NULL'
);
--> statement-breakpoint
PREPARE stmt_id_cards_removed_by_user FROM @id_cards_removed_by_user_sql;
--> statement-breakpoint
EXECUTE stmt_id_cards_removed_by_user;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_id_cards_removed_by_user;
--> statement-breakpoint
SET @fk_orders_placed_by_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'orders_placed_by_user_id_users_id_fk'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD CONSTRAINT `orders_placed_by_user_id_users_id_fk` FOREIGN KEY (`placed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
--> statement-breakpoint
PREPARE stmt_fk_orders_placed_by FROM @fk_orders_placed_by_sql;
--> statement-breakpoint
EXECUTE stmt_fk_orders_placed_by;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_fk_orders_placed_by;
--> statement-breakpoint
SET @fk_orders_school_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND constraint_name = 'orders_school_id_schools_id_fk'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD CONSTRAINT `orders_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
);
--> statement-breakpoint
PREPARE stmt_fk_orders_school FROM @fk_orders_school_sql;
--> statement-breakpoint
EXECUTE stmt_fk_orders_school;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_fk_orders_school;
--> statement-breakpoint
SET @fk_rc_card_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() AND table_name = 'removed_cards_history' AND constraint_name = 'removed_cards_history_id_card_id_id_cards_id_fk'
  ),
  'SELECT 1',
  'ALTER TABLE `removed_cards_history` ADD CONSTRAINT `removed_cards_history_id_card_id_id_cards_id_fk` FOREIGN KEY (`id_card_id`) REFERENCES `id_cards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
);
--> statement-breakpoint
PREPARE stmt_fk_rc_card FROM @fk_rc_card_sql;
--> statement-breakpoint
EXECUTE stmt_fk_rc_card;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_fk_rc_card;
--> statement-breakpoint
SET @fk_rc_school_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() AND table_name = 'removed_cards_history' AND constraint_name = 'removed_cards_history_school_id_schools_id_fk'
  ),
  'SELECT 1',
  'ALTER TABLE `removed_cards_history` ADD CONSTRAINT `removed_cards_history_school_id_schools_id_fk` FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
);
--> statement-breakpoint
PREPARE stmt_fk_rc_school FROM @fk_rc_school_sql;
--> statement-breakpoint
EXECUTE stmt_fk_rc_school;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_fk_rc_school;
--> statement-breakpoint
SET @fk_rc_user_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() AND table_name = 'removed_cards_history' AND constraint_name = 'removed_cards_history_removed_by_user_id_users_id_fk'
  ),
  'SELECT 1',
  'ALTER TABLE `removed_cards_history` ADD CONSTRAINT `removed_cards_history_removed_by_user_id_users_id_fk` FOREIGN KEY (`removed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
--> statement-breakpoint
PREPARE stmt_fk_rc_user FROM @fk_rc_user_sql;
--> statement-breakpoint
EXECUTE stmt_fk_rc_user;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_fk_rc_user;
--> statement-breakpoint
SET @fk_id_cards_removed_by_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_schema = DATABASE() AND table_name = 'id_cards' AND constraint_name = 'id_cards_removed_by_user_id_users_id_fk'
  ),
  'SELECT 1',
  'ALTER TABLE `id_cards` ADD CONSTRAINT `id_cards_removed_by_user_id_users_id_fk` FOREIGN KEY (`removed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
);
--> statement-breakpoint
PREPARE stmt_fk_id_cards_removed_by FROM @fk_id_cards_removed_by_sql;
--> statement-breakpoint
EXECUTE stmt_fk_id_cards_removed_by;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_fk_id_cards_removed_by;
--> statement-breakpoint
SET @idx_orders_school_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'orders_school_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `orders_school_idx` ON `orders` (`school_id`)'
);
--> statement-breakpoint
PREPARE stmt_idx_orders_school FROM @idx_orders_school_sql;
--> statement-breakpoint
EXECUTE stmt_idx_orders_school;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_idx_orders_school;
--> statement-breakpoint
SET @idx_orders_placed_by_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'orders_placed_by_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `orders_placed_by_idx` ON `orders` (`placed_by_user_id`)'
);
--> statement-breakpoint
PREPARE stmt_idx_orders_placed_by FROM @idx_orders_placed_by_sql;
--> statement-breakpoint
EXECUTE stmt_idx_orders_placed_by;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_idx_orders_placed_by;
--> statement-breakpoint
SET @idx_orders_status_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'orders_status_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `orders_status_idx` ON `orders` (`status`)'
);
--> statement-breakpoint
PREPARE stmt_idx_orders_status FROM @idx_orders_status_sql;
--> statement-breakpoint
EXECUTE stmt_idx_orders_status;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_idx_orders_status;
--> statement-breakpoint
SET @idx_orders_created_at_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'orders_created_at_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `orders_created_at_idx` ON `orders` (`created_at`)'
);
--> statement-breakpoint
PREPARE stmt_idx_orders_created_at FROM @idx_orders_created_at_sql;
--> statement-breakpoint
EXECUTE stmt_idx_orders_created_at;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_idx_orders_created_at;
--> statement-breakpoint
SET @idx_rc_section_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = DATABASE() AND table_name = 'removed_cards_history' AND index_name = 'removed_cards_history_school_class_section_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `removed_cards_history_school_class_section_idx` ON `removed_cards_history` (`school_id`,`class_name`,`section`)'
);
--> statement-breakpoint
PREPARE stmt_idx_rc_section FROM @idx_rc_section_sql;
--> statement-breakpoint
EXECUTE stmt_idx_rc_section;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_idx_rc_section;
--> statement-breakpoint
SET @idx_rc_removed_at_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = DATABASE() AND table_name = 'removed_cards_history' AND index_name = 'removed_cards_history_removed_at_idx'
  ),
  'SELECT 1',
  'CREATE INDEX `removed_cards_history_removed_at_idx` ON `removed_cards_history` (`removed_at`)'
);
--> statement-breakpoint
PREPARE stmt_idx_rc_removed_at FROM @idx_rc_removed_at_sql;
--> statement-breakpoint
EXECUTE stmt_idx_rc_removed_at;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_idx_rc_removed_at;