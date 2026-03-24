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
