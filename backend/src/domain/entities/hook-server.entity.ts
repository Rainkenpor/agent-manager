import { z } from 'zod'

export const CreateHookServerSchema = z.object({
	name: z.string().min(1).regex(/^[a-z0-9_-]+$/, 'Only lowercase letters, numbers, hyphens and underscores'),
	displayName: z.string().optional(),
	description: z.string().optional(),
	url: z.string().url(),
	active: z.boolean().optional().default(true)
})

export const UpdateHookServerSchema = z.object({
	displayName: z.string().optional(),
	description: z.string().optional(),
	url: z.string().url().optional(),
	active: z.boolean().optional()
})

export interface HookServerEntity {
	id: string
	name: string
	displayName?: string | null
	description?: string | null
	url: string
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateHookServerDTO {
	name: string
	displayName?: string
	description?: string
	url: string
	active?: boolean
}

export interface UpdateHookServerDTO {
	displayName?: string
	description?: string
	url?: string
	active?: boolean
}

export interface HookDefinitionPayloadField {
	type: string
	description: string
	optional: boolean
}

export interface HookDefinitionEntity {
	name: string
	description: string
	payload: Record<string, HookDefinitionPayloadField>
}

export interface HookAssignmentEntity {
	id: string
	hookServerId: string
	hookName: string
	assignmentType: 'agent' | 'mcp_tool'
	assignmentId: string
	assignmentName: string
	extraData?: Record<string, string> | null
	createdAt: string
}

export interface CreateHookAssignmentDTO {
	hookServerId: string
	hookName: string
	assignmentType: 'agent' | 'mcp_tool'
	assignmentId: string
	assignmentName: string
	extraData?: Record<string, string>
}

export const CreateHookAssignmentSchema = z.object({
	hookServerId: z.string(),
	hookName: z.string(),
	assignmentType: z.enum(['agent', 'mcp_tool']),
	assignmentId: z.string(),
	assignmentName: z.string(),
	extraData: z.record(z.string(), z.string()).optional()
})
