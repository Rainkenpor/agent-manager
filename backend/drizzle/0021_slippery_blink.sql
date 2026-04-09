ALTER TABLE `template_stages` ADD `document_schema` text;--> statement-breakpoint
ALTER TABLE `traceabilities` ADD `created_by` text;--> statement-breakpoint
ALTER TABLE `traceability_templates` DROP COLUMN `document_schema`;