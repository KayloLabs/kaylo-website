CREATE TABLE `professional_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`city` text NOT NULL,
	`skill` text NOT NULL,
	`experience` text NOT NULL,
	`about` text NOT NULL,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL
);
