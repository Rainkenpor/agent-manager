import { z } from 'zod'

const HexColor = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color inválido (usa formato hexadecimal, p. ej. #4f46e5)')

export const CreateIntegrationSchema = z.object({
	name: z.string().min(1),
	origin: z.string().min(1),
	agentSlug: z.string().min(1).optional(),
	agentName: z.string().min(1).optional(),
	scope: z.array(z.string()).optional().default([]),
	description: z.string().optional(),
	buttonColor: HexColor.nullable().optional(),
	iconColor: HexColor.nullable().optional(),
	userBubbleColor: HexColor.nullable().optional(),
	active: z.boolean().optional().default(false)
})

export const UpdateIntegrationSchema = z.object({
	name: z.string().min(1).optional(),
	agentSlug: z.string().min(1).nullable().optional(),
	agentName: z.string().min(1).nullable().optional(),
	scope: z.array(z.string()).optional(),
	description: z.string().nullable().optional(),
	buttonColor: HexColor.nullable().optional(),
	iconColor: HexColor.nullable().optional(),
	userBubbleColor: HexColor.nullable().optional(),
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
	buttonColor?: string | null
	iconColor?: string | null
	userBubbleColor?: string | null
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
	buttonColor?: string | null
	iconColor?: string | null
	userBubbleColor?: string | null
	active?: boolean
}

export interface UpdateIntegrationDTO {
	name?: string
	agentSlug?: string | null
	agentName?: string | null
	scope?: string[]
	description?: string | null
	buttonColor?: string | null
	iconColor?: string | null
	userBubbleColor?: string | null
	active?: boolean
}

/** Una integración está lista para conversar solo cuando está activa y tiene un agente asignado. */
export function isIntegrationConfigured(integration: IntegrationEntity): boolean {
	return integration.active && !!integration.agentSlug
}
