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

			signal.addEventListener('abort', () => {
				console.log('Message streaming aborted by client')
			})

			const sendEvent = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`)

			try {
				await container.streamMessageUseCase.execute(input.id, input.content, sendEvent, signal)
			} catch (error) {
				if ((error as any)?.name !== 'AbortError') {
					sendEvent({ type: 'error', error: error instanceof Error ? error.message : 'Error desconocido' })
				}
			}

			res.end()
			return null
		}
	})
}
