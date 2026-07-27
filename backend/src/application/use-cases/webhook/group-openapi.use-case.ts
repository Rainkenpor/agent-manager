import type { WebhookContractField, WebhookEntity } from '@domain/entities/webhook.entity.js'
import type { WebhookGroupEntity } from '@domain/entities/webhook-group.entity.js'
import { container } from '../../container.js'

/**
 * Construye el documento OpenAPI de un grupo de webhooks: cada webhook activo del grupo
 * se publica como un endpoint, con su contrato de entrada (requeridos / opcionales) y su
 * esquema de autenticación. Es lo que consume la referencia Scalar en `/api/<grupo>`.
 */
export interface WebhookGroupOpenApiResult {
	success: boolean
	data?: Record<string, unknown>
	error?: string
}

export class WebhookGroupOpenApiUseCase {
	/**
	 * El `server` del documento es siempre relativo: el proxy inverso no informa el protocolo real
	 * (manda `x-forwarded-proto: http` sobre un sitio HTTPS), así que cualquier URL absoluta armada
	 * aquí terminaría bloqueada por mixed content. El visor lo resuelve contra el origen de la página.
	 */
	async execute(groupName: string): Promise<WebhookGroupOpenApiResult> {
		const group = await container.webhookGroupRepository.findByName(groupName)
		if (!group?.active) return { success: false, error: `Grupo "${groupName}" no encontrado` }

		const webhooks = (await container.webhookRepository.findByGroupId(group.id)).filter((w) => w.active)
		const paths: Record<string, Record<string, unknown>> = {}

		for (const webhook of webhooks) {
			const path = `/${webhook.name}`
			paths[path] = { ...(paths[path] ?? {}), [webhook.method.toLowerCase()]: this.operation(group, webhook) }
		}

		const serverUrl = `/api/${group.name}`

		return {
			success: true,
			data: {
				openapi: '3.1.0',
				info: {
					title: `Webhooks · ${group.name}`,
					version: '1.0.0',
					description: group.description ?? `Endpoints del grupo "${group.name}".`
				},
				servers: [{ url: serverUrl, description: `Grupo "${group.name}"` }],
				components: {
					securitySchemes: {
						webhookSecret: {
							type: 'apiKey',
							in: 'header',
							name: 'X-Webhook-Secret',
							description: group.authEnabled
								? `Secret del grupo "${group.name}": el mismo para todos sus endpoints. También se acepta como \`Authorization: Bearer <secret>\`.`
								: 'Token secreto del webhook. También se acepta como `Authorization: Bearer <secret>`.'
						}
					}
				},
				paths
			}
		}
	}

	private operation(group: WebhookGroupEntity, webhook: WebhookEntity): Record<string, unknown> {
		const requiresSecret = group.authEnabled || webhook.authEnabled
		const operation: Record<string, unknown> = {
			tags: [group.name],
			summary: webhook.name,
			description: this.describe(webhook),
			operationId: `${group.name}_${webhook.name}_${webhook.method.toLowerCase()}`,
			responses: this.responses(webhook, requiresSecret)
		}

		if (requiresSecret) operation.security = [{ webhookSecret: [] }]

		if (webhook.targetType === 'llm') {
			operation.requestBody = { required: true, content: { 'application/json': { schema: OPENAI_REQUEST_SCHEMA } } }
			return operation
		}

		const contract = webhook.contract ?? []
		if (contract.length === 0) return operation

		if (webhook.method === 'GET' || webhook.method === 'DELETE') {
			operation.parameters = contract.map((field) => ({
				name: field.name,
				in: 'query',
				required: field.required,
				description: field.description,
				schema: fieldSchema(field)
			}))
			return operation
		}

		operation.requestBody = {
			required: contract.some((f) => f.required),
			content: {
				'application/json': {
					schema: {
						type: 'object',
						properties: Object.fromEntries(contract.map((field) => [field.name, fieldSchema(field, field.description)])),
						required: contract.filter((f) => f.required).map((f) => f.name)
					}
				}
			}
		}
		return operation
	}

	private describe(webhook: WebhookEntity): string {
		const target =
			webhook.targetType === 'agent'
				? `Ejecuta el agente **${webhook.targetName}**.`
				: webhook.targetType === 'llm'
					? 'Expone el LLM directo con contrato compatible con OpenAI Chat Completions.'
					: `Ejecuta la herramienta MCP **${webhook.targetName}** de \`${webhook.extraData?.mcpServerName ?? 'MCP'}\`.`
		return [webhook.description, target].filter(Boolean).join('\n\n')
	}

	private responses(webhook: WebhookEntity, requiresSecret: boolean): Record<string, unknown> {
		if (webhook.targetType === 'llm') {
			return {
				'200': { description: 'Respuesta del modelo (o stream SSE si `stream: true`).' },
				'400': { description: 'Request inválido.' },
				...(requiresSecret ? { '401': { description: 'Secret inválido o ausente.' } } : {}),
				'404': { description: 'El webhook no existe, está inactivo o el método no corresponde.' }
			}
		}

		return {
			'202': {
				description: 'Aceptado. La ejecución ocurre en background.',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								success: { type: 'boolean' },
								message: { type: 'string' },
								webhook: { type: 'string' }
							}
						}
					}
				}
			},
			'400': {
				description: 'El payload no cumple el contrato.',
				content: {
					'application/json': {
						schema: {
							type: 'object',
							properties: {
								error: { type: 'string' },
								details: { type: 'array', items: { type: 'string' } }
							}
						}
					}
				}
			},
			...(requiresSecret ? { '401': { description: 'Secret inválido o ausente.' } } : {}),
			'404': { description: 'El webhook no existe, está inactivo o el método no corresponde.' }
		}
	}
}

function fieldSchema(field: WebhookContractField, description?: string): Record<string, unknown> {
	const schema: Record<string, unknown> = {}
	// Los tipos unión y `any` del contrato no tienen equivalente directo en un `type` de JSON Schema.
	if (field.type !== 'any' && !field.type.includes('|')) schema.type = field.type
	if (field.enumValues?.length) schema.enum = field.enumValues
	if (description) schema.description = description
	return schema
}

const OPENAI_REQUEST_SCHEMA = {
	type: 'object',
	properties: {
		model: { type: 'string', description: 'Se ignora; se usa siempre el proveedor activo (sólo se hace echo).' },
		messages: {
			type: 'array',
			description: 'Debe incluir al menos un mensaje con role "user".',
			items: {
				type: 'object',
				properties: {
					role: { type: 'string', enum: ['system', 'user', 'assistant', 'tool'] },
					content: { type: 'string' }
				},
				required: ['role', 'content']
			}
		},
		max_tokens: { type: 'integer' },
		stream: { type: 'boolean', description: 'Si es true, la respuesta es un stream SSE estilo OpenAI.' }
	},
	required: ['messages']
} as const
