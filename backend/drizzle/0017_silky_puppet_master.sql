CREATE TABLE `template_stage_predecessors` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`predecessor_stage_id` text NOT NULL,
	FOREIGN KEY (`stage_id`) REFERENCES `template_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`predecessor_stage_id`) REFERENCES `template_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `traceability_stage_predecessors` (
	`id` text PRIMARY KEY NOT NULL,
	`stage_id` text NOT NULL,
	`predecessor_stage_id` text NOT NULL,
	FOREIGN KEY (`stage_id`) REFERENCES `traceability_stages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`predecessor_stage_id`) REFERENCES `traceability_stages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `template_stages` ADD `type` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `template_stages` ADD `agent_id` text REFERENCES agents(id);--> statement-breakpoint
ALTER TABLE `traceability_stages` ADD `type` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `traceability_stages` ADD `agent_id` text REFERENCES agents(id);