CREATE TABLE `sentixQuickAnalyses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`text` text NOT NULL,
	`analysis` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sentixQuickAnalyses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sentix_quick_analysis_user_idx` ON `sentixQuickAnalyses` (`userId`);