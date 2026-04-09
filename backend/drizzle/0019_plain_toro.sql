ALTER TABLE `traceability_templates` ADD `code` text;--> statement-breakpoint
ALTER TABLE `traceability_templates` ADD `document_schema` text;--> statement-breakpoint
CREATE UNIQUE INDEX `traceability_templates_code_unique` ON `traceability_templates` (`code`);