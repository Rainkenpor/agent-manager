import { registry } from '@applicationService/registry.service.js'
import { container } from '../container.js'
import { z } from 'zod'

export function registerCredentialsRoutes(): void {
	registry.register({
		useBy: ['mcp'],
		method: 'GET',
		path: '/api/credentials/mcp',
		toolName: 'get_user_mcp_credentials',
		toolDescription:
			'Obtiene las credenciales de un usuario para un servicio MCP específico. Devuelve la lista de credenciales (clave/valor) almacenadas para ese servidor.',
		toolSource: 'Credenciales',
		inputSchema: z.object({ mcp_server_id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'read' },
		handler: async ({ input, context }) => {
			const userId = context.req.user?.id
			if (!userId) return { success: false, error: 'Unauthorized' }
			return container.getMcpCredentialsUseCase.execute(userId, input.mcp_server_id)
		}
	})

	registry.register({
		useBy: ['mcp'],
		method: 'POST',
		path: '/api/credentials/mcp',
		toolName: 'set_user_mcp_credential',
		toolDescription: 'Almacena o actualiza una credencial (clave/valor) de un usuario para un servidor MCP específico.',
		toolSource: 'Credenciales',
		inputSchema: z.object({
			mcp_server_id: z.string(),
			key: z.string(),
			value: z.string()
		}).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async ({ input, context }) => {
			const userId = context.req.user?.id
			if (!userId) return { success: false, error: 'Unauthorized' }
			return container.upsertMcpCredentialUseCase.execute({
				userId,
				mcpServerId: input.mcp_server_id,
				key: input.key,
				value: input.value
			})
		}
	})

	registry.register({
		useBy: ['mcp'],
		method: 'DELETE',
		path: '/api/credentials/mcp',
		toolName: 'delete_user_mcp_credential',
		toolDescription: 'Elimina una credencial específica (por clave) de un usuario para un servidor MCP.',
		toolSource: 'Credenciales',
		inputSchema: z.object({
			mcp_server_id: z.string(),
			key: z.string()
		}).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'update' },
		handler: async ({ input, context }) => {
			const userId = context.req.user?.id
			if (!userId) return { success: false, error: 'Unauthorized' }
			return container.deleteMcpCredentialUseCase.execute(userId, input.mcp_server_id, input.key)
		}
	})

	registry.register({
		useBy: ['mcp'],
		method: 'GET',
		path: '/api/credentials/mcp/list',
		toolName: 'list_mcp_credential_fields',
		toolDescription: 'Lista todas las credenciales almacenadas del usuario en todos los servidores MCP activos.',
		toolSource: 'Credenciales',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'users', action: 'read' },
		handler: async ({ context }) => {
			const userId = context.req.user?.id
			if (!userId) return { success: false, error: 'Unauthorized' }
			return container.getMcpCredentialsUseCase.execute(userId)
		}
	})
}
