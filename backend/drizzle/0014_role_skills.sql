CREATE TABLE `role_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`role_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`assigned_at` text NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON DELETE CASCADE
);
