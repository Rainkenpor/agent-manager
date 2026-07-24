import { z } from 'zod'

export const CreateWebhookGroupSchema = z.object({
	name: z
		.string()
		.min(1)
		.regex(/^[a-z0-9_-]+$/, 'Only lowercase letters, numbers, hyphens and underscores'),
	description: z.string().optional(),
	active: z.boolean().optional().default(true)
})

export const UpdateWebhookGroupSchema = z.object({
	description: z.string().optional(),
	active: z.boolean().optional()
})

export interface WebhookGroupEntity {
	id: string
	name: string
	description?: string | null
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateWebhookGroupDTO {
	name: string
	description?: string
	active?: boolean
}

export interface UpdateWebhookGroupDTO {
	description?: string
	active?: boolean
}

/** Nombre del grupo al que se migran los webhooks creados antes de existir los grupos. */
export const DEFAULT_WEBHOOK_GROUP = 'default'
