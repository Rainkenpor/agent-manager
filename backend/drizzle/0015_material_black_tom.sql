CREATE TABLE `role_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
