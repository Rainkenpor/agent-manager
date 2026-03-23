import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'

const upsertSchema = z.object({
	mcpServerId: z.string().min(1),
	key: z.string().min(1),
	value: z.string()
})

const deleteSchema = z.object({
	mcpServerId: z.string().min(1),
	key: z.string().min(1)
})

export function registerMcpCredentialRoutes(): void {
	// GET /api/mcp-credentials — all credentials for the current user (across all MCPs)
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/mcp-credentials',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'mcp_credentials', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = (req as any).user?.id
			return container.getMcpCredentialsUseCase.execute(userId)
		}
	})

	// GET /api/mcp-credentials/:mcpServerId — credentials for a specific MCP
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/mcp-credentials/:mcpServerId',
		inputSchema: z.object({ mcpServerId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'mcp_credentials', action: 'read' },
		handler: async ({ input, context: { req } }) => {
			const userId = (req as any).user?.id
			return container.getMcpCredentialsUseCase.execute(userId, input.mcpServerId)
		}
	})

	// PUT /api/mcp-credentials — upsert a credential
	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/mcp-credentials',
		inputSchema: upsertSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'mcp_credentials', action: 'write' },
		handler: async ({ input, context: { req } }) => {
			const userId = (req as any).user?.id
			return container.upsertMcpCredentialUseCase.execute({
				userId,
				mcpServerId: input.mcpServerId,
				key: input.key,
				value: input.value
			})
		}
	})

	// DELETE /api/mcp-credentials/:mcpServerId/:key
	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/mcp-credentials/:mcpServerId/:key',
		inputSchema: deleteSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'mcp_credentials', action: 'write' },
		handler: async ({ input, context: { req } }) => {
			const userId = (req as any).user?.id
			return container.deleteMcpCredentialUseCase.execute(userId, input.mcpServerId, input.key)
		}
	})
}
