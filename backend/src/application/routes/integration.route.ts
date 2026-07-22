import { registry } from '@applicationService/registry.service.js'
import { CreateIntegrationSchema, isIntegrationConfigured, UpdateIntegrationSchema } from '@domain/entities/integration.entity.js'
import { z } from 'zod'
import { container } from '../container.js'
import { INTEGRATION_CHAT_USER_ID } from '../use-cases/integration/create-integration-conversation.use-case.js'

/** Normaliza un valor a su origen (`scheme://host[:port]`). Acepta un origen puro o un referer con ruta. */
function normalizeOrigin(value: string | undefined): string {
	if (!value) return ''
	try {
		return new URL(value).origin
	} catch {
		return value.trim()
	}
}

const createConversationSchema = z.object({
	origin: z.string().optional()
})

const sendMessageSchema = z.object({
	id: z.string(),
	content: z.string().min(1),
	origin: z.string().optional()
})

const suggestSchema = z.object({
	q: z.string().min(1)
})

export function registerIntegrationRoutes(): void {
	// ── Endpoints públicos del widget ────────────────────────────────────────

	// Inicia una conversación resolviendo la integración por origen. Auto-registra orígenes nuevos.
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/integration/chat/conversations',
		inputSchema: createConversationSchema.shape,
		requiresAuth: false,
		handler: async ({ input, context: { req } }) => {
			// El widget reenvía el origen anfitrión en el body; los headers son respaldo.
			const origin = normalizeOrigin(input.origin || req.header('origin') || req.header('referer'))
			return await container.createIntegrationConversationUseCase.execute(origin)
		}
	})

	// Envía un mensaje a una conversación de integración — responde vía SSE.
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/integration/chat/conversations/:id/messages',
		inputSchema: sendMessageSchema.shape,
		requiresAuth: false,
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

			const sendEvent = (data: Record<string, unknown>) => res.write(`data: ${JSON.stringify(data)}\n\n`)

			try {
				const conv = await container.chatRepository.findConversationById(input.id)
				if (!conv || conv.userId !== INTEGRATION_CHAT_USER_ID) {
					sendEvent({ type: 'error', error: 'Conversación no encontrada' })
					return null
				}

				const origin = normalizeOrigin(input.origin || req.header('origin') || req.header('referer'))
				const integration = origin ? await container.integrationRepository.findByOrigin(origin) : null
				const contextLines = [`Origen del sitio: ${origin || 'desconocido'}`]
				if (integration?.scope?.length) contextLines.push(`Scope solicitado: ${integration.scope.join(', ')}`)
				const extraContext = contextLines.join('\n')

				await container.integrationChatAnswerUseCase.execute(input.id, input.content, sendEvent, signal, extraContext)
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

	// Apariencia del widget resuelta por origen (público). Permite pintar el botón con los
	// colores configurados antes de abrir el chat, sin crear una conversación.
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/integration/config',
		inputSchema: createConversationSchema.shape,
		requiresAuth: false,
		handler: async ({ input, context: { req } }) => {
			const origin = normalizeOrigin(input.origin || req.header('origin') || req.header('referer'))
			const integration = origin ? await container.integrationRepository.findByOrigin(origin) : null
			return {
				success: true,
				data: {
					configured: !!integration && isIntegrationConfigured(integration),
					agentName: integration?.agentName ?? null,
					buttonColor: integration?.buttonColor ?? null,
					iconColor: integration?.iconColor ?? null,
					userBubbleColor: integration?.userBubbleColor ?? null
				}
			}
		}
	})

	// Sugerencias de preguntas preestablecidas mientras el usuario escribe (público).
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/integration/qna/suggest',
		inputSchema: suggestSchema.shape,
		requiresAuth: false,
		handler: async ({ input }) => {
			const data = await container.suggestPresetQnaUseCase.execute(input.q)
			return { success: true, data }
		}
	})

	// ── CRUD de administración ───────────────────────────────────────────────

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/integrations',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'integrations', action: 'read' },
		handler: async () => {
			const integrations = await container.integrationRepository.findAll()
			return { success: true, data: integrations }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/integrations/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'integrations', action: 'read' },
		handler: async ({ input, context: { res } }) => {
			const integration = await container.integrationRepository.findById(input.id)
			if (!integration) return res.status(404).json({ error: 'Integración no encontrada' })
			return { success: true, data: integration }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/integrations',
		inputSchema: CreateIntegrationSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'integrations', action: 'create' },
		handler: async ({ context: { req, res } }) => {
			try {
				const origin = normalizeOrigin(req.body.origin)
				const existing = await container.integrationRepository.findByOrigin(origin)
				if (existing) return res.status(400).json({ error: `Ya existe una integración para el origen "${origin}"` })
				const integration = await container.integrationRepository.create({ ...req.body, origin })
				return res.status(201).json({ success: true, data: integration })
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/integrations/:id',
		inputSchema: { ...UpdateIntegrationSchema.shape, id: z.string() },
		requiresAuth: true,
		requiredPermission: { resource: 'integrations', action: 'update' },
		handler: async ({ context: { req, res } }) => {
			try {
				const integration = await container.integrationRepository.update(req.params.id as string, req.body)
				return { success: true, data: integration }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/integrations/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'integrations', action: 'delete' },
		handler: async ({ input, context: { res } }) => {
			try {
				await container.integrationRepository.delete(input.id)
				return { success: true, message: 'Integración eliminada' }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})
}
