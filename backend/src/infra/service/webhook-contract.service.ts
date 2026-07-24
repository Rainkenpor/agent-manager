/**
 * webhook-contract.service.ts
 *
 * Deriva el contrato de entrada de un webhook a partir del inputSchema de la tool MCP
 * destino, y valida los payloads entrantes contra ese contrato.
 */

import { registry } from '@applicationService/registry.service.js'
import type { WebhookContractField } from '@domain/entities/webhook.entity.js'
import { z } from 'zod'
import { container } from '../../application/container.js'
import { mcpExternalManager } from './mcp-external.js'

type JsonSchema = {
	properties?: Record<string, Record<string, unknown>>
	required?: string[]
}

/** Convierte un JSON Schema de tool en la lista plana de campos del contrato. */
export function buildContractFromJsonSchema(schema: unknown): WebhookContractField[] {
	const { properties, required } = (schema ?? {}) as JsonSchema
	if (!properties) return []
	const requiredSet = new Set(required ?? [])

	return Object.entries(properties).map(([name, prop]) => {
		const enumValues = Array.isArray(prop.enum) ? prop.enum.map(String) : undefined
		return {
			name,
			type: jsonSchemaType(prop),
			required: requiredSet.has(name),
			description: typeof prop.description === 'string' ? prop.description : undefined,
			enumValues
		}
	})
}

function jsonSchemaType(prop: Record<string, unknown>): string {
	if (typeof prop.type === 'string') return prop.type
	if (Array.isArray(prop.type)) return prop.type.filter((t) => t !== 'null').join('|') || 'any'
	if (Array.isArray(prop.anyOf)) {
		const types = (prop.anyOf as Array<Record<string, unknown>>).map((s) => jsonSchemaType(s)).filter((t) => t !== 'null')
		return [...new Set(types)].join('|') || 'any'
	}
	return 'any'
}

/** Obtiene el inputSchema (JSON Schema) de una tool, sea del MCP local o de un MCP externo. */
export async function getToolInputSchema(mcpServerName: string, toolName: string): Promise<unknown | null> {
	const server = await container.mcpServerRepository.findByName(mcpServerName)
	if (!server) return null

	if (server.type === 'local') {
		const route = registry.getRoutes().find((r) => r.useBy?.includes('mcp') && r.toolName === toolName)
		if (!route) return null
		const zodSchema = route.inputSchema instanceof z.ZodObject ? route.inputSchema : z.object((route.inputSchema ?? {}) as z.ZodRawShape)
		const jsonSchema = z.toJSONSchema(zodSchema) as Record<string, unknown>
		delete jsonSchema.$schema
		return jsonSchema
	}

	await mcpExternalManager.ensureServerInitialized(server.name, server, server.id)
	const tool = mcpExternalManager.getToolsForServer(server.name).find((t) => t.toolName === toolName)
	return tool?.inputSchema ?? null
}

export async function deriveMcpToolContract(mcpServerName: string, toolName: string): Promise<WebhookContractField[]> {
	const schema = await getToolInputSchema(mcpServerName, toolName)
	return buildContractFromJsonSchema(schema)
}

/**
 * Valida el payload entrante contra el contrato y devuelve sólo los campos declarados.
 * Los valores que llegan por query string son strings, así que se coercionan al tipo declarado.
 */
export function validateAgainstContract(
	contract: WebhookContractField[],
	payload: Record<string, unknown>
): { errors: string[]; value: Record<string, unknown> } {
	const errors: string[] = []
	const value: Record<string, unknown> = {}

	for (const field of contract) {
		const raw = payload[field.name]

		if (raw === undefined || raw === null || raw === '') {
			if (field.required) errors.push(`"${field.name}" es requerido`)
			continue
		}

		const coerced = coerce(raw, field.type)
		if (coerced === INVALID) {
			errors.push(`"${field.name}" debe ser de tipo ${field.type}`)
			continue
		}
		if (field.enumValues?.length && !field.enumValues.includes(String(coerced))) {
			errors.push(`"${field.name}" debe ser uno de: ${field.enumValues.join(', ')}`)
			continue
		}
		value[field.name] = coerced
	}

	return { errors, value }
}

const INVALID = Symbol('invalid')

function coerce(raw: unknown, type: string): unknown {
	const types = type.split('|')
	if (types.length > 1 || type === 'any') return raw

	switch (type) {
		case 'number':
		case 'integer': {
			const n = typeof raw === 'number' ? raw : Number(raw)
			if (Number.isNaN(n) || (type === 'integer' && !Number.isInteger(n))) return INVALID
			return n
		}
		case 'boolean': {
			if (typeof raw === 'boolean') return raw
			if (raw === 'true') return true
			if (raw === 'false') return false
			return INVALID
		}
		case 'array': {
			if (Array.isArray(raw)) return raw
			if (typeof raw === 'string') return parseJson(raw, Array.isArray)
			return INVALID
		}
		case 'object': {
			if (typeof raw === 'object') return raw
			if (typeof raw === 'string') return parseJson(raw, (v) => typeof v === 'object' && v !== null && !Array.isArray(v))
			return INVALID
		}
		case 'string':
			return typeof raw === 'string' ? raw : String(raw)
		default:
			return raw
	}
}

function parseJson(raw: string, matches: (value: unknown) => boolean): unknown {
	try {
		const parsed = JSON.parse(raw)
		return matches(parsed) ? parsed : INVALID
	} catch {
		return INVALID
	}
}
