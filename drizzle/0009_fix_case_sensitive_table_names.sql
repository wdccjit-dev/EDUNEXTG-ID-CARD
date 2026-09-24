-- Databases imported from Windows can contain lowercase versions of the two
-- legacy camelCase table names. Linux MySQL uses case-sensitive table names,
-- so rename them only when the server requires an exact match.
SET @rename_templates_sql = IF(
  @@lower_case_table_names = 0
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND BINARY table_name = 'idcardtemplates'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND BINARY table_name = 'idCardTemplates'
  ),
  'RENAME TABLE `idcardtemplates` TO `idCardTemplates`',
  'SELECT 1'
);--> statement-breakpoint
PREPARE rename_templates_stmt FROM @rename_templates_sql;--> statement-breakpoint
EXECUTE rename_templates_stmt;--> statement-breakpoint
DEALLOCATE PREPARE rename_templates_stmt;--> statement-breakpoint

SET @rename_requests_sql = IF(
  @@lower_case_table_names = 0
  AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND BINARY table_name = 'idcardrequests'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = DATABASE() AND BINARY table_name = 'idCardRequests'
  ),
  'RENAME TABLE `idcardrequests` TO `idCardRequests`',
  'SELECT 1'
);--> statement-breakpoint
PREPARE rename_requests_stmt FROM @rename_requests_sql;--> statement-breakpoint
EXECUTE rename_requests_stmt;--> statement-breakpoint
DEALLOCATE PREPARE rename_requests_stmt;
