CREATE TABLE `schools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`shortCode` varchar(16) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `schools_id` PRIMARY KEY(`id`),
	CONSTRAINT `schools_shortCode_unique` UNIQUE(`shortCode`)
);

CREATE TABLE `idCardTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`meta` varchar(191),
	`accent` enum('teal','coral','indigo','yellow') NOT NULL DEFAULT 'teal',
	`status` enum('active','draft') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idCardTemplates_id` PRIMARY KEY(`id`)
);

CREATE TABLE `idCardRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentName` varchar(191) NOT NULL,
	`admissionCode` varchar(64) NOT NULL,
	`schoolId` int NOT NULL,
	`status` enum('pending','approved','changes_requested') NOT NULL DEFAULT 'pending',
	`reviewNote` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `idCardRequests_id` PRIMARY KEY(`id`)
);

ALTER TABLE `idCardRequests` ADD CONSTRAINT `idCardRequests_schoolId_schools_id_fk` FOREIGN KEY (`schoolId`) REFERENCES `schools`(`id`) ON DELETE no action ON UPDATE no action;
