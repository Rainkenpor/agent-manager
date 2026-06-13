import { z } from 'zod'

export const WebhookMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

export type WebhookMethod = (typeof WebhookMethods)[number]

export const CreateWebhookSchema = z.object({
	name: z
		.string()
		.min(1)
		.regex(/^[a-z0-9_-]+$/, 'Only lowercase letters, numbers, hyphens and underscores'),
	description: z.string().optional(),
	method: z.enum(WebhookMethods).optional().default('POST'),
	targetType: z.enum(['agent', 'mcp_tool']),
	targetId: z.string().min(1),
	targetName: z.string().min(1),
	extraData: z.record(z.string(), z.string()).optional(),
	authEnabled: z.boolean().optional().default(true),
	active: z.boolean().optional().default(true)
})

export const UpdateWebhookSchema = z.object({
	description: z.string().optional(),
	method: z.enum(WebhookMethods).optional(),
	targetType: z.enum(['agent', 'mcp_tool']).optional(),
	targetId: z.string().min(1).optional(),
	targetName: z.string().min(1).optional(),
	extraData: z.record(z.string(), z.string()).optional(),
	authEnabled: z.boolean().optional(),
	active: z.boolean().optional()
})

export interface WebhookEntity {
	id: string
	name: string
	description?: string | null
	method: WebhookMethod
	targetType: 'agent' | 'mcp_tool'
	targetId: string
	targetName: string
	extraData?: Record<string, string> | null
	authEnabled: boolean
	secret?: string | null
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateWebhookDTO {
	name: string
	description?: string
	method?: WebhookMethod
	targetType: 'agent' | 'mcp_tool'
	targetId: string
	targetName: string
	extraData?: Record<string, string>
	authEnabled?: boolean
	active?: boolean
}

export interface UpdateWebhookDTO {
	description?: string
	method?: WebhookMethod
	targetType?: 'agent' | 'mcp_tool'
	targetId?: string
	targetName?: string
	extraData?: Record<string, string>
	authEnabled?: boolean
	active?: boolean
}
