/**
 * hook-dispatcher.service.ts
 *
 * Maintains SSE connections to registered hook servers.
 * When a hook event fires, dispatches to all assigned agents / MCP tools.
 */
import { AgentService } from './agent.service.js'
import { mcpExternalManager } from './mcp-external.js'
import { logger } from './logger.service.js'
import type { IHookServerRepository } from '../../domain/repositories/hook-server.repository.js'
import type { HookServerEntity } from '../../domain/entities/hook-server.entity.js'

interface ActiveSubscription {
	serverId: string
	serverUrl: string
	abort: AbortController
}

export class HookDispatcherService {
	private subscriptions = new Map<string, ActiveSubscription>()
	private repo: IHookServerRepository

	constructor(repo: IHookServerRepository) {
		this.repo = repo
	}

	async initializeAll(): Promise<void> {
		const servers = await this.repo.findAll()
		for (const server of servers) {
			if (server.active) {
				this.subscribeToServer(server)
			}
		}
		logger.info(`HookDispatcher: initialized ${servers.filter((s) => s.active).length} active hook servers`)
	}

	subscribeToServer(server: HookServerEntity): void {
		if (this.subscriptions.has(server.id)) {
			this.unsubscribeFromServer(server.id)
		}

		const abort = new AbortController()
		const streamUrl = server.url.replace(/\/$/, '') + '/hooks/stream'

		this.subscriptions.set(server.id, {
			serverId: server.id,
			serverUrl: server.url,
			abort
		})

		this.listenLoop(server.id, streamUrl, abort.signal).catch((err) => {
			logger.warn(`HookDispatcher: connection to ${server.name} ended — ${err?.message ?? err}`)
		})
	}

	unsubscribeFromServer(serverId: string): void {
		const sub = this.subscriptions.get(serverId)
		if (sub) {
			sub.abort.abort()
			this.subscriptions.delete(serverId)
		}
	}

	private async listenLoop(serverId: string, streamUrl: string, signal: AbortSignal): Promise<void> {
		const backoffMs = [1000, 3000, 10000, 30000]
		let attempt = 0

		while (!signal.aborted) {
			try {
				const res = await fetch(streamUrl, {
					signal,
					headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache' }
				})

				if (!res.ok || !res.body) {
					throw new Error(`HTTP ${res.status}`)
				}

				attempt = 0 // reset backoff on success
				logger.info(`HookDispatcher: connected to ${streamUrl}`)

				const reader = res.body.getReader()
				const decoder = new TextDecoder()
				let buffer = ''

				while (!signal.aborted) {
					const { done, value } = await reader.read()
					if (done) break
					buffer += decoder.decode(value, { stream: true })
					const parts = buffer.split('\n\n')
					buffer = parts.pop() ?? ''
					for (const part of parts) {
						const line = part.trim()
						if (!line.startsWith('data:')) continue
						const raw = line.slice(5).trim()
						try {
							const event = JSON.parse(raw)
							if (event.name && event.name !== 'connected') {
								await this.dispatch(serverId, event.name, event.payload ?? {})
							}
						} catch {
							// ignore malformed events
						}
					}
				}
			} catch (err: any) {
				if (signal.aborted) return
				const delay = backoffMs[Math.min(attempt, backoffMs.length - 1)]
				attempt++
				logger.warn(`HookDispatcher: ${streamUrl} error (${err?.message}), retrying in ${delay}ms`)
				await new Promise((r) => setTimeout(r, delay))
			}
		}
	}

	private async dispatch(hookServerId: string, hookName: string, payload: Record<string, unknown>): Promise<void> {
		const assignments = await this.repo.getAssignments(hookServerId, hookName)
		if (assignments.length === 0) return

		const payloadStr = JSON.stringify(payload, null, 2)

		for (const assignment of assignments) {
			try {
				if (assignment.assignmentType === 'agent') {
					const agentService = new AgentService()
					await agentService.executeAgent({
						agentSlug: assignment.assignmentId,
						query: `Hook event fired: ${hookName}\n\nPayload:\n${payloadStr}`
					})
					logger.info(`HookDispatcher: dispatched hook "${hookName}" to agent "${assignment.assignmentName}"`)
				} else if (assignment.assignmentType === 'mcp_tool') {
					const mcpServerName = assignment.extraData?.mcpServerName
					if (!mcpServerName) continue
					await mcpExternalManager.ensureServerInitialized(mcpServerName, { url: assignment.extraData?.mcpServerUrl ?? '' } as any)
					logger.info(`HookDispatcher: dispatched hook "${hookName}" to tool "${assignment.assignmentName}"`)
				}
			} catch (err: any) {
				logger.error(`HookDispatcher: error dispatching hook "${hookName}" to "${assignment.assignmentName}": ${err?.message}`)
			}
		}
	}
}
