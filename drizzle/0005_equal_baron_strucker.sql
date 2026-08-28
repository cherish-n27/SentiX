CREATE TABLE `sentixLocalAccounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sentixLocalAccounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `sentixLocalAccounts_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `sentixLocalAccounts_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE INDEX `sentix_local_account_user_idx` ON `sentixLocalAccounts` (`userId`);