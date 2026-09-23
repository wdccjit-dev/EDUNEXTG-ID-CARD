ALTER TABLE `password_resets` ADD `token_prefix` varchar(16);--> statement-breakpoint
CREATE INDEX `password_resets_prefix_idx` ON `password_resets` (`token_prefix`);