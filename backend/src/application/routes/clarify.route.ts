import { registry } from '@applicationService/registry.service.js'
import { mcpExternalManager } from '@infra/service/mcp-external.js'
import { z } from 'zod'

const createDocumentSchema = z.object({
	title: z.string().min(1, 'Título es requerido'),
	filename: z.string().min(1, 'filename es requerido'),
	mimeType: z.string().optional(),
	fileBase64: z.string().min(1, 'fileBase64 es requerido'),
	categoryIds: z.array(z.string()).min(1, 'Debes enviar al menos una categoría')
})

/** Llama una tool del MCP externo `clarify` y parsea su respuesta JSON ({ success, data } | { success, error }). */
async function callClarify(toolName: string, args: Record<string, unknown>, userId?: string): Promise<unknown> {
	const raw = await mcpExternalManager.callTool(`mcp__clarify__${toolName}`, args, userId)
	try {
		return JSON.parse(raw)
	} catch {
		return { success: false, error: raw }
	}
}

export function registerClarifyRoutes(): void {
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/clarify/projects',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'clarify', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = (req as any).user?.id as string | undefined
			return callClarify('list_projects', { showDescription: true }, userId)
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/clarify/documents',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'clarify', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = (req as any).user?.id as string | undefined
			return callClarify('list_documents', {}, userId)
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/clarify/document-categories',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'clarify', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = (req as any).user?.id as string | undefined
			return callClarify('list_document_categories', {}, userId)
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/clarify/documents',
		inputSchema: createDocumentSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'clarify', action: 'create' },
		handler: async ({ input, context: { req } }) => {
			const userId = (req as any).user?.id as string | undefined
			return callClarify(
				'create_document_from_base64',
				{
					title: input.title,
					filename: input.filename,
					...(input.mimeType ? { mimeType: input.mimeType } : {}),
					fileBase64: input.fileBase64,
					categoryIds: input.categoryIds
				},
				userId
			)
		}
	})
}
