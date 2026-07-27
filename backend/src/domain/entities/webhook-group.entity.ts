import { z } from 'zod'

export const CreateWebhookGroupSchema = z.object({
	name: z
		.string()
		.min(1)
		.regex(/^[a-z0-9_-]+$/, 'Only lowercase letters, numbers, hyphens and underscores'),
	description: z.string().optional(),
	authEnabled: z.boolean().optional().default(true),
	active: z.boolean().optional().default(true)
})

export const UpdateWebhookGroupSchema = z.object({
	description: z.string().optional(),
	authEnabled: z.boolean().optional(),
	active: z.boolean().optional()
})

export interface WebhookGroupEntity {
	id: string
	name: string
	description?: string | null
	/** Cuando está activo, el secret del grupo es el único válido para todos sus webhooks. */
	authEnabled: boolean
	secret?: string | null
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateWebhookGroupDTO {
	name: string
	description?: string
	authEnabled?: boolean
	active?: boolean
}

export interface UpdateWebhookGroupDTO {
	description?: string
	authEnabled?: boolean
	active?: boolean
}

/** Nombre del grupo al que se migran los webhooks creados antes de existir los grupos. */
export const DEFAULT_WEBHOOK_GROUP = 'default'
