ALTER TABLE `id_card_data` MODIFY COLUMN `field_value` longtext;--> statement-breakpoint
ALTER TABLE `id_card_files` MODIFY COLUMN `file_url` longtext NOT NULL;
