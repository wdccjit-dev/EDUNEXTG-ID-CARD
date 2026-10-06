SET @id_card_templates_card_type_sql = IF(
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = DATABASE() AND table_name = 'idCardTemplates' AND column_name = 'cardType'
  ),
  'SELECT 1',
  'ALTER TABLE `idCardTemplates` ADD COLUMN `cardType` enum(\'student\',\'staff\') DEFAULT \'student\' NOT NULL'
);
--> statement-breakpoint
PREPARE stmt_id_card_templates_card_type FROM @id_card_templates_card_type_sql;
--> statement-breakpoint
EXECUTE stmt_id_card_templates_card_type;
--> statement-breakpoint
DEALLOCATE PREPARE stmt_id_card_templates_card_type;