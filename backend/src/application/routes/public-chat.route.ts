import { registry } from '@applicationService/registry.service.js'
import { z } from 'zod'
import { container } from '../container.js'
import { PUBLIC_CHAT_USER_ID } from '../use-cases/chat/create-public-conversation.use-case.js'

const createPublicConversationSchema = z.object({
	title: z.string().min(1).optional()
})

const sendPublicMessageSchema = z.object({
	id: z.string(),
	content: z.string().min(1)
})

const suggestSchema = z.object({
	q: z.string().min(1)
})

export function registerPublicChatRoutes(): void {
	// Create a public conversation locked to the conocimiento-distelsa agent
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/public/chat/conversations',
		inputSchema: createPublicConversationSchema.shape,
		requiresAuth: false,
		handler: async ({ input }) => {
			return await container.createPublicConversationUseCase.execute({ title: input.title ?? 'Asistente Distelsa' })
		}
	})

	// Send a message to a public conversation — streams the response via SSE
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/public/chat/conversations/:id/messages',
		inputSchema: sendPublicMessageSchema.shape,
		requiresAuth: false,
		handler: async ({ input, context: { res, signal } }) => {
			res.setHeader('Content-Type', 'text/event-stream')
			res.setHeader('Cache-Control', 'no-cache')
			res.setHeader('Connection', 'keep-alive')
			res.setHeader('X-Accel-Buffering', 'no')
			res.flushHeaders()

			const sendEvent = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`)

			const conv = await container.chatRepository.findConversationById(input.id)
			if (!conv || conv.userId !== PUBLIC_CHAT_USER_ID) {
				sendEvent({ type: 'error', error: 'Conversación no encontrada' })
				res.end()
				return null
			}

			try {
				await container.publicChatAnswerUseCase.execute(input.id, input.content, sendEvent, signal)
			} catch (error) {
				if ((error as any)?.name !== 'AbortError') {
					sendEvent({ type: 'error', error: error instanceof Error ? error.message : 'Error desconocido' })
				}
			}

			res.end()
			return null
		}
	})

	// Sugerencias de preguntas preestablecidas mientras el usuario escribe (público)
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/public/qna/suggest',
		inputSchema: suggestSchema.shape,
		requiresAuth: false,
		handler: async ({ input }) => {
			const data = await container.suggestPresetQnaUseCase.execute(input.q)
			return { success: true, data }
		}
	})
}
