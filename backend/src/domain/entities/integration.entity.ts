import { z } from 'zod'

export const CreateIntegrationSchema = z.object({
	name: z.string().min(1),
	origin: z.string().min(1),
	agentSlug: z.string().min(1).optional(),
	agentName: z.string().min(1).optional(),
	scope: z.array(z.string()).optional().default([]),
	description: z.string().optional(),
	active: z.boolean().optional().default(false)
})

export const UpdateIntegrationSchema = z.object({
	name: z.string().min(1).optional(),
	agentSlug: z.string().min(1).nullable().optional(),
	agentName: z.string().min(1).nullable().optional(),
	scope: z.array(z.string()).optional(),
	description: z.string().nullable().optional(),
	active: z.boolean().optional()
})

export interface IntegrationEntity {
	id: string
	name: string
	origin: string
	agentSlug?: string | null
	agentName?: string | null
	scope: string[]
	description?: string | null
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateIntegrationDTO {
	name: string
	origin: string
	agentSlug?: string | null
	agentName?: string | null
	scope?: string[]
	description?: string | null
	active?: boolean
}

export interface UpdateIntegrationDTO {
	name?: string
	agentSlug?: string | null
	agentName?: string | null
	scope?: string[]
	description?: string | null
	active?: boolean
}

/** Una integración está lista para conversar solo cuando está activa y tiene un agente asignado. */
export function isIntegrationConfigured(integration: IntegrationEntity): boolean {
	return integration.active && !!integration.agentSlug
}
