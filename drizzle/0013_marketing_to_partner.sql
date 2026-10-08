ALTER TABLE `users` MODIFY COLUMN `role` enum('SUPER_ADMIN','SCHOOL_ADMIN','SCHOOL_OPERATOR','VIEWER','PARTNER','PARTNER_ADMIN','MARKETING_ADMIN') NOT NULL DEFAULT 'VIEWER';--> statement-breakpoint
UPDATE `users` SET `role` = 'PARTNER' WHERE `role` = 'MARKETING_ADMIN';--> statement-breakpoint
UPDATE `orders` SET `placed_by_role` = 'PARTNER' WHERE `placed_by_role` = 'MARKETING_ADMIN';--> statement-breakpoint
UPDATE `audit_logs` SET `actor_role` = 'PARTNER' WHERE `actor_role` = 'MARKETING_ADMIN';
