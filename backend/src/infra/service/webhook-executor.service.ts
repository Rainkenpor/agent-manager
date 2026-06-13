/**
 * webhook-executor.service.ts
 *
 * Executes the target (agent or MCP tool) of an inbound webhook in background.
 */

import type { WebhookEntity } from '../../domain/entities/webhook.entity.js'
import { AgentService } from './agent.service.js'
import { logger } from './logger.service.js'
import { mcpExternalManager } from './mcp-external.js'

export class WebhookExecutorService {
	async execute(webhook: WebhookEntity, payload: Record<string, unknown>): Promise<void> {
		const payloadStr = JSON.stringify(payload, null, 2)

		try {
			if (webhook.targetType === 'agent') {
				const agentService = new AgentService()
				await agentService.executeAgent({
					agentSlug: webhook.targetId,
					query: `Webhook "${webhook.name}" triggered\n\nPayload:\n${payloadStr}`
				})
				logger.info(`WebhookExecutor: webhook "${webhook.name}" dispatched to agent "${webhook.targetName}"`)
			} else if (webhook.targetType === 'mcp_tool') {
				const mcpServerName = webhook.extraData?.mcpServerName
				if (!mcpServerName) {
					logger.error(`WebhookExecutor: webhook "${webhook.name}" has no mcpServerName in extraData`)
					return
				}
				await mcpExternalManager.ensureServerInitialized(mcpServerName, { url: webhook.extraData?.mcpServerUrl ?? '' } as any)
				const toolId = `mcp__${mcpServerName}__${webhook.targetName}`
				const result = await mcpExternalManager.callTool(toolId, payload)
				logger.info(`WebhookExecutor: webhook "${webhook.name}" dispatched to tool "${webhook.targetName}" → ${result}`)
			}
		} catch (err: any) {
			logger.error(`WebhookExecutor: error executing webhook "${webhook.name}": ${err?.message}`)
		}
	}
}
