CREATE TABLE `template_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`role` text,
	`order` integer DEFAULT 0 NOT NULL,
	`parallel_group` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `traceability_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `traceabilities` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`template_id` text,
	`template_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `traceability_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `traceability_links` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`platform` text DEFAULT 'generic' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`stage_id`) REFERENCES `traceability_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `traceability_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`traceability_id` text NOT NULL,
	`template_stage_id` text,
	`name` text NOT NULL,
	`description` text,
	`role` text,
	`order` integer DEFAULT 0 NOT NULL,
	`parallel_group` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`traceability_id`) REFERENCES `traceabilities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_stage_id`) REFERENCES `template_stages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `traceability_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'task' NOT NULL,
	`status` text DEFAULT 'todo' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`stage_id`) REFERENCES `traceability_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `traceability_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
