import { registry } from '@applicationService/registry.service.js'
import { listAvailableAgentTools } from '@applicationService/agent-tools.service.js'
import { container } from '../container.js'
import { z } from 'zod'

const createAgentSchema = z.object({
	name: z.string().min(1),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/),
	description: z.string().optional(),
	mode: z.enum(['primary', 'subagent']).default('subagent'),
	model: z.string().default('<<AGENT_MODEL>>'),
	temperature: z.string().default('0.2'),
	tools: z.record(z.string(), z.boolean()).default({}),
	content: z.string().default(''),
	subagentIds: z.array(z.string()).optional()
})

const updateAgentSchema = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/)
		.optional(),
	description: z.string().nullable().optional(),
	mode: z.enum(['primary', 'subagent']).optional(),
	model: z.string().optional(),
	temperature: z.string().optional(),
	tools: z.record(z.string(), z.boolean()).optional(),
	content: z.string().optional(),
	useByChat: z.boolean().optional(),
	isActive: z.boolean().optional(),
	subagentIds: z.array(z.string()).optional()
})

const getAgentSchema = z.object({ id: z.string() })
const deleteAgentSchema = z.object({ id: z.string() })
const getAgent = z.object({})

export function registerAgentRoutes(): void {
	// ==========================================
	// AGENT ROUTES
	// ==========================================

	// List available tools (builtin + registry + external MCP)
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/agents/tools',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'read' },
		handler: async () => {
			const tools = await listAvailableAgentTools()
			return { success: true, data: tools }
		}
	})

	// List agents available for chat based on the current user's roles
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/agents/for-chat',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = (req.user as any)?.id as string
			const userRoles = await container.userRepository.getRoles(userId)
			// Collect all agents assigned to the user's roles that are useByChat
			const seen = new Set<string>()
			const result: Array<{ id: string; name: string; slug: string; description: string | null }> = []
			if (userRoles.length === 0) {
				// No roles — return all active useByChat agents
				const all = await container.listAgentsUseCase.execute()
				if (!all.success) return { success: true as const, data: [] }
				const agentList = (all.data ?? []).filter((a: any) => a.isActive && a.useByChat)
				return { success: true as const, data: agentList.map((a: any) => ({ id: a.id, name: a.name, slug: a.slug, description: a.description ?? null })) }
			}
			for (const role of userRoles) {
				const roleAgents = await container.mcpServerRepository.getAgentsByRole(role.id)
				for (const agent of roleAgents) {
					if (!seen.has(agent.id)) {
						seen.add(agent.id)
						result.push({ id: agent.id, name: agent.name, slug: agent.slug, description: null })
					}
				}
			}
			// Filter to only active useByChat agents — fetch full agent to check flags
			const filtered: typeof result = []
			for (const a of result) {
				const full = await container.getAgentUseCase.execute(a.id)
				if (!full.success) continue
				if (full.data.isActive) {
					filtered.push({ id: a.id, name: a.name, slug: a.slug, description: full.data.description ?? null })
				}
			}
			return { success: true as const, data: filtered }
		},
	})

	// List all agents
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/agents',
		inputSchema: getAgent.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'read' },
		handler: async () => {
			return await container.listAgentsUseCase.execute()
		}
	})

	// Get agent by ID
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/agents/:id',
		inputSchema: getAgentSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'read' },

		handler: async ({ input }) => {
			return await container.getAgentUseCase.execute(input.id)
		}
	})

	// Create agent
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/agents',
		inputSchema: createAgentSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'create' },
		handler: async ({ input }) => {
			return await container.createAgentUseCase.execute({
				...input,
				tools: (input.tools ?? {}) as Record<string, boolean>
			})
		}
	})

	// Update agent
	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/agents/:id',
		inputSchema: updateAgentSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'update' },
		handler: async ({ input }) => {
			return await container.updateAgentUseCase.execute({
				...input,
				tools: input.tools as Record<string, boolean> | undefined
			})
		}
	})

	// Delete agent
	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/agents/:id',
		inputSchema: deleteAgentSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'delete' },
		handler: async ({ input }) => {
			return await container.deleteAgentUseCase.execute(input.id)
		}
	})

	// Duplicate agent
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/agents/:id/duplicate',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'create' },
		handler: async ({ input }) => {
			return await container.duplicateAgentUseCase.execute(input.id)
		}
	})

	// ==============================================
	// AGENT-ROLE ASSIGNMENT ROUTES
	// ==============================================
	// Assign agent to role
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/roles/:roleId/agents/:agentId',
		inputSchema: z.object({ roleId: z.string(), agentId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'update' },
		handler: async ({ input, context: { req, res } }) => {
			try {
				await container.mcpServerRepository.assignAgentToRole(input.roleId, input.agentId)
				return { message: 'Agent assigned to role' }
			} catch (error: any) {
				res.status(400).json({ error: error.message })
			}
		}
	})

	// Remove agent from role
	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/roles/:roleId/agents/:agentId',
		inputSchema: z.object({ roleId: z.string(), agentId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'agents', action: 'update' },
		handler: async ({ input, context: { req, res } }) => {
			try {
				await container.mcpServerRepository.removeAgentFromRole(input.roleId, input.agentId)
				return { success: true, message: 'Agent removed from role' }
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		}
	})

	// Get agents assigned to a role
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/roles/:roleId/agents',
		inputSchema: z.object({ roleId: z.string() }).shape,
		requiresAuth: true,
		handler: async ({ input, context: { req, res } }) => {
			try {
				const agentList = await container.mcpServerRepository.getAgentsByRole(input.roleId)
				return { success: true, data: agentList }
			} catch (error: any) {
				res.status(500).json({ error: error.message })
			}
		}
	})
}
