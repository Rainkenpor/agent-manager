import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { envs } from '../../envs.js'
import { container } from '../container.js'

// Sin título ni agente: el título se autogenera tras el primer intercambio y el enrutador decide el agente.
const createConversationSchema = z.object({
	title: z.string().optional(),
	agentId: z.string().min(1).optional()
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

const taskSchema = z.object({
	chatId: z.string(),
	name: z.string(),
	description: z.string().optional()
})

const taskUpdateSchema = z.object({
	id: z.string(),
	chatId: z.string(),
	status: z.enum(['pending', 'in_progress', 'completed', 'failed'])
})

const tempSendEvent: Map<string, (data: Record<string, unknown>) => void> = new Map()

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

			let agentId = input.agentId
			if (!agentId) {
				const router = await container.agentRepository.findBySlug(envs.ROUTER_AGENT_SLUG)
				if (!router) return { success: false as const, error: 'Agente enrutador no disponible' }
				agentId = router.id
			}

			return await container.createConversationUseCase.execute({
				title: input.title ?? '',
				agentId,
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
		handler: async ({ input, context: { res, signal } }) => {
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

			// Se agrega el sendEvent
			tempSendEvent.set(input.id, sendEvent)

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

			// Finaliza el sendEvent
			await container.taskConversationsUseCase.deleteChatId(input.id)
			tempSendEvent.delete(input.id)

			res.end()
			return null
		}
	})

	/**
	 * ===================================================================================================================
	 * TASK
	 * ===================================================================================================================
	 */
	registry.register({
		useBy: ['mcp'],
		method: 'POST',
		path: '/api/chat/task',
		inputSchema: taskSchema.shape,
		toolName: 'create_task_chat',
		toolDescription: 'Creación de tareas dentro del chat',
		toolAvailableViaChat: true,
		toolShowAssignment: false,
		handler: async ({ input }) => {
			const chatId = input.chatId

			const sendEvent = tempSendEvent.get(chatId)
			if (!sendEvent) return { status: false, message: 'No se encontró sendEvent' }

			return await container.taskConversationsUseCase.create({ ...input, sendEvent })
		}
	})

	registry.register({
		useBy: ['mcp'],
		method: 'PUT',
		path: '/api/chat/task',
		inputSchema: taskUpdateSchema.shape,
		toolName: 'update_task_chat',
		toolDescription: 'Actualización del status de una tarea dentro del chat',
		toolAvailableViaChat: true,
		toolShowAssignment: false,
		handler: async ({ input }) => {
			const chatId = input.chatId
			const sendEvent = tempSendEvent.get(chatId)
			if (!sendEvent) return { status: false, message: 'No se encontró sendEvent' }
			return await container.taskConversationsUseCase.update({ ...input, sendEvent })
		}
	})
}
