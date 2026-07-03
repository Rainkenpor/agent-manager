import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { container } from '../container.js'

const createConversationSchema = z.object({
	title: z.string().min(1),
	agentId: z.string().min(1)
})

const sendMessageSchema = z.object({
	id: z.string(),
	content: z.string().min(1)
})

const truncateSchema = z.object({
	id: z.string(),
	messageId: z.string()
})

const persistedImageSchema = z.object({
	serverId: z.string().optional(),
	toolName: z.string(),
	args: z.record(z.string(), z.unknown()).default({}),
	mimeType: z.string(),
	thumb: z.string()
})

const attachImagesSchema = z.object({
	id: z.string(),
	images: z.array(persistedImageSchema)
})

export function registerChatRoutes(): void {
	// List conversations for the authenticated user
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/chat/conversations',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'read' },
		handler: async ({ context: { req } }) => {
			const userId = (req as any).user?.id
			return await container.listConversationsUseCase.execute(userId)
		}
	})

	// Get a single conversation with its messages
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/chat/conversations/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'read' },
		handler: async ({ input }) => {
			return await container.getConversationUseCase.execute(input.id)
		}
	})

	// Create a new conversation
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/chat/conversations',
		inputSchema: createConversationSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'create' },
		handler: async ({ input, context: { req } }) => {
			const userId = (req as any).user?.id
			return await container.createConversationUseCase.execute({
				title: input.title,
				agentId: input.agentId,
				userId
			})
		}
	})

	// Delete a conversation
	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/chat/conversations/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'delete' },
		handler: async ({ input }) => {
			return await container.deleteConversationUseCase.execute(input.id)
		}
	})

	// Truncate messages from a given message ID (inclusive)
	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/chat/conversations/:id/messages/from/:messageId',
		inputSchema: truncateSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'delete' },
		handler: async ({ input }) => {
			return await container.truncateMessagesUseCase.execute(input.id, input.messageId)
		}
	})

	// Attach persisted image thumbnails to an assistant message
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/chat/messages/:id/images',
		inputSchema: attachImagesSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'create' },
		handler: async ({ input, context: { req } }) => {
			const userId = (req as any).user?.id
			return await container.appendMessageImagesUseCase.execute(input.id, userId, input.images)
		}
	})

	// Send a message — streams the response via SSE
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/chat/conversations/:id/messages',
		inputSchema: sendMessageSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'chat', action: 'create' },
		handler: async ({ input, context: { req, res, signal } }) => {
			res.setHeader('Content-Type', 'text/event-stream')
			res.setHeader('Cache-Control', 'no-cache')
			res.setHeader('Connection', 'keep-alive')
			res.setHeader('X-Accel-Buffering', 'no')
			res.flushHeaders()

			// Mantener viva la conexión SSE mientras el modelo genera el primer token.
			// Sin esto, un LLM local lento (a menudo tras un proxy con read-timeout) deja
			// la conexión inactiva, el cliente/proxy la cierra, se aborta el fetch al LLM y
			// el servidor local reporta "Connection handling canceled" sin devolver nada.
			const heartbeat = setInterval(() => {
				if (!res.writableEnded) res.write(': keep-alive\n\n')
			}, 15000)

			signal.addEventListener('abort', () => {
				console.log('Message streaming aborted by client')
			})

			const sendEvent = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`)

			try {
				await container.streamMessageUseCase.execute(input.id, input.content, sendEvent, signal)
			} catch (error) {
				// Un cliente que se desconecta aborta el fetch al LLM; undici lo expone como
				// AbortError o como un TypeError envuelto. Nunca mostrar un abort como error de
				// chat: el cliente ya no está para recibirlo.
				if (!signal.aborted && (error as any)?.name !== 'AbortError') {
					sendEvent({ type: 'error', error: error instanceof Error ? error.message : 'Error desconocido' })
				}
			} finally {
				clearInterval(heartbeat)
			}

			res.end()
			return null
		}
	})
}
