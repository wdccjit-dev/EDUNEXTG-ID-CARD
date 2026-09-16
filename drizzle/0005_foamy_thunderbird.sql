ALTER TABLE `idCardTemplates` ADD `orientation` enum('portrait','landscape') DEFAULT 'landscape' NOT NULL;--> statement-breakpoint
ALTER TABLE `idCardTemplates` ADD `cardWidth` int DEFAULT 324 NOT NULL;--> statement-breakpoint
ALTER TABLE `idCardTemplates` ADD `cardHeight` int DEFAULT 204 NOT NULL;