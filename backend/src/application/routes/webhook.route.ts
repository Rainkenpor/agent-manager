import { timingSafeEqual } from 'node:crypto'
import { registry } from '@applicationService/registry.service.js'
import { CreateWebhookSchema, UpdateWebhookSchema, type WebhookContractField, WebhookMethods } from '@domain/entities/webhook.entity.js'
import { CreateWebhookGroupSchema, UpdateWebhookGroupSchema } from '@domain/entities/webhook-group.entity.js'
import { logger } from '@infra/service/logger.service.js'
import { deriveMcpToolContract, validateAgainstContract } from '@infra/service/webhook-contract.service.js'
import { z } from 'zod'
import { container } from '../container.js'
import { WebhookGroupOpenApiUseCase } from '../use-cases/webhook/group-openapi.use-case.js'
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

/**
 * El nombre del grupo es el primer segmento del endpoint público (`/api/<grupo>/<webhook>`),
 * así que no puede coincidir con el primer segmento de ninguna ruta ya registrada de la API.
 */
function reservedGroupNames(): Set<string> {
	const segments = registry
		.getRoutes()
		.filter((r) => r.path.startsWith('/api/'))
		.map((r) => r.path.split('/')[2])
		.filter((s): s is string => !!s && !s.startsWith(':'))
	return new Set(segments)
}

async function handleLlmTrigger(
	webhook: Awaited<ReturnType<typeof container.webhookRepository.findById>>,
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

/** Deriva el contrato de entrada cuando el destino es una tool MCP; para los demás destinos no hay contrato. */
async function contractFor(body: {
	targetType?: string
	targetName?: string
	extraData?: Record<string, string>
}): Promise<WebhookContractField[] | null> {
	if (body.targetType !== 'mcp_tool') return null
	const mcpServerName = body.extraData?.mcpServerName
	if (!mcpServerName || !body.targetName) return null
	return deriveMcpToolContract(mcpServerName, body.targetName)
}

export function registerWebhookRoutes(): void {
	// ── Grupos ────────────────────────────────────────────────────────────────────

	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/webhook-groups',
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'read' },
		handler: async () => {
			const groups = await container.webhookGroupRepository.findAll()
			return { success: true, data: groups }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/webhook-groups',
		inputSchema: CreateWebhookGroupSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'create' },
		handler: async ({ input, context: { res } }) => {
			if (reservedGroupNames().has(input.name)) {
				return res.status(400).json({ error: `"${input.name}" es un nombre reservado por la API` })
			}
			const existing = await container.webhookGroupRepository.findByName(input.name)
			if (existing) return res.status(400).json({ error: `El grupo "${input.name}" ya existe` })
			const group = await container.webhookGroupRepository.create(input)
			return res.status(201).json({ success: true, data: group })
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'PUT',
		path: '/api/webhook-groups/:id',
		inputSchema: { ...UpdateWebhookGroupSchema.shape, id: z.string() },
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'update' },
		handler: async ({ input, context: { res } }) => {
			const { id, ...data } = input
			const group = await container.webhookGroupRepository.findById(id)
			if (!group) return res.status(404).json({ error: 'Grupo no encontrado' })
			return { success: true, data: await container.webhookGroupRepository.update(id, data) }
		}
	})

	registry.register({
		useBy: ['server'],
		method: 'DELETE',
		path: '/api/webhook-groups/:id',
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: 'webhooks', action: 'delete' },
		handler: async ({ input, context: { res } }) => {
			const webhooks = await container.webhookRepository.findByGroupId(input.id)
			if (webhooks.length > 0) {
				return res.status(400).json({ error: `El grupo tiene ${webhooks.length} webhook(s); elimínalos primero` })
			}
			await container.webhookGroupRepository.delete(input.id)
			return { success: true, message: 'Grupo eliminado' }
		}
	})

	// ── Webhooks ──────────────────────────────────────────────────────────────────

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
				const group = await container.webhookGroupRepository.findById(req.body.groupId)
				if (!group) return res.status(400).json({ error: 'El grupo indicado no existe' })
				const existing = await container.webhookRepository.findByGroupIdAndName(group.id, req.body.name)
				if (existing) return res.status(400).json({ error: `El webhook "${req.body.name}" ya existe en el grupo "${group.name}"` })
				const contract = await contractFor(req.body)
				const webhook = await container.webhookRepository.create({ ...req.body, contract })
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
				const current = await container.webhookRepository.findById(req.params.id as string)
				if (!current) return res.status(404).json({ error: 'Webhook not found' })

				const groupId = req.body.groupId ?? current.groupId
				if (req.body.groupId) {
					const group = await container.webhookGroupRepository.findById(groupId)
					if (!group) return res.status(400).json({ error: 'El grupo indicado no existe' })
					const clash = await container.webhookRepository.findByGroupIdAndName(groupId, current.name)
					if (clash && clash.id !== current.id) {
						return res.status(400).json({ error: `El webhook "${current.name}" ya existe en el grupo "${group.name}"` })
					}
				}

				// El destino sólo se re-evalúa si viene en el request; si no cambia, el contrato guardado sigue vigente.
				const targetChanged = req.body.targetType !== undefined || req.body.targetName !== undefined || req.body.extraData !== undefined
				const contract = targetChanged
					? await contractFor({
							targetType: req.body.targetType ?? current.targetType,
							targetName: req.body.targetName ?? current.targetName,
							extraData: req.body.extraData ?? current.extraData ?? undefined
						})
					: undefined

				const webhook = await container.webhookRepository.update(req.params.id as string, {
					...req.body,
					...(contract !== undefined ? { contract } : {})
				})
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

/**
 * Página de referencia Scalar. El bundle standalone se sirve desde CDN; se soportan las dos
 * formas de arranque porque la API del bundle cambió entre versiones mayores.
 */
function scalarPage(groupName: string, specUrl: string): string {
	return `<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Webhooks · ${groupName}</title>
	</head>
	<body>
		<div id="app"></div>
		<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
		<script>
			const config = { url: ${JSON.stringify(specUrl)} }
			if (window.Scalar?.createApiReference) window.Scalar.createApiReference('#app', config)
			else window.Scalar?.createScalarReferences?.(document.getElementById('app'), config)
		</script>
	</body>
</html>`
}

/** Origen público de la petición, respetando el proxy inverso. */
function requestOrigin(req: any): string {
	const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol
	return `${proto}://${req.get('host')}`
}

/**
 * Endpoints públicos: `/api/<grupo>/<webhook>`, más la documentación del grupo en `/api/<grupo>`.
 * Debe registrarse al final del registry para que los `:group`/`:slug` no capturen rutas propias de la API.
 */
export function registerWebhookTriggerRoutes(): void {
	const openApiUseCase = new WebhookGroupOpenApiUseCase()

	// Documento OpenAPI del grupo
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/:group/openapi.json',
		inputSchema: z.object({ group: z.string() }).shape,
		requiresAuth: false,
		handler: async ({ input, context: { req, res } }) => {
			const result = await openApiUseCase.execute(input.group, requestOrigin(req))
			if (!result.success) {
				res.status(404).json({ error: result.error })
				return null
			}
			res.json(result.data)
			return null
		}
	})

	// Referencia Scalar del grupo
	registry.register({
		useBy: ['server'],
		method: 'GET',
		path: '/api/:group',
		inputSchema: z.object({ group: z.string() }).shape,
		requiresAuth: false,
		handler: async ({ input, context: { req, res } }) => {
			const result = await openApiUseCase.execute(input.group, requestOrigin(req))
			if (!result.success) {
				res.status(404).json({ error: result.error })
				return null
			}
			res.setHeader('Content-Type', 'text/html; charset=utf-8')
			res.send(scalarPage(input.group, `${requestOrigin(req)}/api/${input.group}/openapi.json`))
			return null
		}
	})

	const triggerHandler = async ({ input, context: { req, res, signal } }: any) => {
		const group = await container.webhookGroupRepository.findByName(input.group)
		const webhook = group?.active ? await container.webhookRepository.findByGroupIdAndName(group.id, input.slug) : null
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

		const raw: Record<string, unknown> = req.method === 'GET' || req.method === 'DELETE' ? { ...req.query } : (req.body ?? {})

		let payload = raw
		if (webhook.contract?.length) {
			const { errors, value } = validateAgainstContract(webhook.contract, raw)
			if (errors.length > 0) {
				return res.status(400).json({ error: 'Validation error', details: errors })
			}
			payload = value
		}

		setImmediate(() => {
			container.webhookExecutor.execute(webhook, payload).catch((err) => {
				logger.error(`Webhook "${group?.name}/${webhook.name}": ${err?.message}`)
			})
		})

		return res.status(202).json({ success: true, message: 'Accepted', webhook: `${group?.name}/${webhook.name}` })
	}

	for (const method of WebhookMethods) {
		registry.register({
			useBy: ['server'],
			method,
			path: '/api/:group/:slug',
			inputSchema: z.object({ group: z.string(), slug: z.string() }).shape,
			requiresAuth: false,
			handler: triggerHandler
		})
	}

	// Alias compatible con SDKs de OpenAI: baseURL = <API>/<grupo>/<webhook> → añade /chat/completions
	registry.register({
		useBy: ['server'],
		method: 'POST',
		path: '/api/:group/:slug/chat/completions',
		inputSchema: z.object({ group: z.string(), slug: z.string() }).shape,
		requiresAuth: false,
		handler: triggerHandler
	})
}
