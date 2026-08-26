CREATE TABLE `sentixChatMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`citations` json,
	`followUps` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sentixChatMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sentixWorkspaceReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`clientReviewId` varchar(100) NOT NULL,
	`text` text NOT NULL,
	`author` varchar(255),
	`source` varchar(255),
	`rating` int,
	`category` varchar(160) NOT NULL,
	`label` enum('Positive','Neutral','Negative') NOT NULL,
	`compound` decimal(5,3) NOT NULL,
	`confidence` int NOT NULL,
	`vaderCompound` decimal(5,3) NOT NULL,
	`transformerConfidence` int,
	`transformerUsed` boolean NOT NULL DEFAULT false,
	`actionTag` varchar(255) NOT NULL,
	`reviewedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sentixWorkspaceReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sentixWorkspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sentixWorkspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sentix_chat_workspace_idx` ON `sentixChatMessages` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `sentix_review_workspace_idx` ON `sentixWorkspaceReviews` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `sentix_workspace_user_idx` ON `sentixWorkspaces` (`userId`);