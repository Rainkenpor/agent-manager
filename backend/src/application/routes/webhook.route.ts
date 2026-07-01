import { timingSafeEqual } from 'node:crypto'
import { registry } from '@applicationService/registry.service.js'
import { CreateWebhookSchema, UpdateWebhookSchema, WebhookMethods } from '@domain/entities/webhook.entity.js'
import { logger } from '@infra/service/logger.service.js'
import { z } from 'zod'
import { container } from '../container.js'
import { type OpenAiChatRequest, WebhookLlmCompletionUseCase } from '../use-cases/webhook/llm-completion.use-case.js'

function secretMatches(provided: string | undefined, expected: string | null | undefined): boolean {
	if (!provided || !expected) return false
	const a = Buffer.from(provided)
	const b = Buffer.from(expected)
	return a.length === b.length && timingSafeEqual(a, b)
}

/** Extrae el secret del header X-Webhook-Secret o de Authorization: Bearer (compat OpenAI). */
function providedSecret(req: { header: (name: string) => string | undefined }): string | undefined {
	const direct = req.header('x-webhook-secret')
	if (direct) return direct
	const auth = req.header('authorization')
	if (auth?.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim()
	return undefined
}

async function handleLlmTrigger(
	webhook: Awaited<ReturnType<typeof container.webhookRepository.findByName>>,
	req: any,
	res: any,
	signal?: AbortSignal
) {
	if (!webhook) return res.status(404).json({ error: 'Webhook not found' })
	const body = (req.body ?? {}) as OpenAiChatRequest
	const useCase = new WebhookLlmCompletionUseCase()

	if (body.stream) {
		res.setHeader('Content-Type', 'text/event-stream')
		res.setHeader('Cache-Control', 'no-cache')
		res.setHeader('Connection', 'keep-alive')
		res.setHeader('X-Accel-Buffering', 'no')
		res.flushHeaders()
		try {
			for await (const chunk of useCase.completeStream(webhook, body, signal)) {
				res.write(`data: ${JSON.stringify(chunk)}\n\n`)
			}
		} catch (err: any) {
			res.write(`data: ${JSON.stringify({ error: err?.message ?? 'Error' })}\n\n`)
		}
		res.write('data: [DONE]\n\n')
		res.end()
		return null
	}

	try {
		const result = await useCase.completeJson(webhook, body, signal)
		return res.json(result)
	} catch (err: any) {
		return res.status(400).json({ error: err?.message ?? 'Error' })
	}
}

export function registerWebhookRoutes(): void {
	// ── Public trigger endpoint ───────────────────────────────────────────────────

	const triggerHandler = async ({ input, context: { req, res, signal } }: any) => {
		const webhook = await container.webhookRepository.findByName(input.slug)
		// Same 404 for missing, inactive or wrong method to avoid leaking existence
		if (!webhook?.active || webhook.method !== req.method) {
			return res.status(404).json({ error: 'Webhook not found' })
		}

		if (webhook.authEnabled && !secretMatches(providedSecret(req), webhook.secret)) {
			return res.status(401).json({ error: 'Invalid or missing X-Webhook-Secret' })
		}

		if (webhook.targetType === 'llm') {
			return handleLlmTrigger(webhook, req, res, signal)
		}

		const payload: Record<string, unknown> = req.method === 'GET' || req.method === 'DELETE' ? { ...req.query } : (req.body ?? {})

		setImmediate(() => {
			container.webhookExecutor.execute(webhook, payload).catch((err) => {
				logger.error(`Webhook "${webhook.name}": ${err?.message}`)
			})
		})

		return res.status(202).json({ success: true, message: 'Accepted', webhook: webhook.name })
	}

	for (const method of WebhookMethods) {
		registry.register({
			useBy: ['server'],
			method,
			path: '/api/webhooks/trigger/:slug',
			inputSchema: z.object({ slug: z.string() }).shape,
			requiresAuth: false,
			handler: triggerHandler
		})
	}

	// Alias compatible con SDKs de OpenAI: baseURL = <API>/webhooks/trigger/:slug → añade /chat/completions
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/webhooks/trigger/:slug/chat/completions',
		inputSchema: z.object({ slug: z.string() }).shape,
		requiresAuth: false,
		handler: triggerHandler
	})

	// ── CRUD ──────────────────────────────────────────────────────────────────────

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/webhooks',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'read' },
		handler: async () => {
			const webhooks = await container.webhookRepository.findAll()
			return { success: true, data: webhooks }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/webhooks/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'read' },
		handler: async ({ input, context: { res } }) => {
			const webhook = await container.webhookRepository.findById(input.id)
			if (!webhook) return res.status(404).json({ error: 'Webhook not found' })
			return { success: true, data: webhook }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/webhooks',
		inputSchema: CreateWebhookSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'create' },
		handler: async ({ context: { req, res } }) => {
			try {
				const existing = await container.webhookRepository.findByName(req.body.name)
				if (existing) return res.status(400).json({ error: `Webhook "${req.body.name}" already exists` })
				const webhook = await container.webhookRepository.create(req.body)
				return res.status(201).json({ success: true, data: webhook })
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/webhooks/:id',
		inputSchema: { ...UpdateWebhookSchema.shape, id: z.string() },
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'update' },
		handler: async ({ context: { req, res } }) => {
			try {
				const webhook = await container.webhookRepository.update(req.params.id as string, req.body)
				return { success: true, data: webhook }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/webhooks/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'delete' },
		handler: async ({ input, context: { res } }) => {
			try {
				await container.webhookRepository.delete(input.id)
				return { success: true, message: 'Webhook deleted' }
			} catch (error: any) {
				return res.status(400).json({ error: error.message })
			}
		}
	})
}
