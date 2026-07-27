/**
 * webhook-executor.service.ts
 *
 * Executes the target (agent or MCP tool) of an inbound webhook.
 */

import type { WebhookEntity } from '../../domain/entities/webhook.entity.js'
import { AgentService } from './agent.service.js'
import { logger } from './logger.service.js'
import { mcpExternalManager } from './mcp-external.js'

export class WebhookExecutorService {
	/** Ejecuta el destino del webhook y devuelve lo que haya respondido. Propaga el error si falla. */
	async execute(webhook: WebhookEntity, payload: Record<string, unknown>): Promise<unknown> {
		const payloadStr = JSON.stringify(payload, null, 2)

		if (webhook.targetType === 'agent') {
			const agentService = new AgentService()
			const result = await agentService.executeAgent({
				agentSlug: webhook.targetId,
				query: `Webhook "${webhook.name}" triggered\n\nPayload:\n${payloadStr}`
			})
			logger.info(`WebhookExecutor: webhook "${webhook.name}" dispatched to agent "${webhook.targetName}"`)
			return result
		}

		if (webhook.targetType === 'mcp_tool') {
			const mcpServerName = webhook.extraData?.mcpServerName
			if (!mcpServerName) {
				throw new Error(`Webhook "${webhook.name}" has no mcpServerName in extraData`)
			}
			await mcpExternalManager.ensureServerInitialized(mcpServerName, { url: webhook.extraData?.mcpServerUrl ?? '' } as any)
			const toolId = `mcp__${mcpServerName}__${webhook.targetName}`
			const result = await mcpExternalManager.callTool(toolId, payload)
			logger.info(`WebhookExecutor: webhook "${webhook.name}" dispatched to tool "${webhook.targetName}"`)
			return result
		}

		return null
	}
}

/** El contenido de una tool MCP llega como texto; se devuelve como JSON cuando lo es. */
export function parseToolResult(result: unknown): unknown {
	if (typeof result !== 'string') return result
	try {
		return JSON.parse(result)
	} catch {
		return result
	}
}
