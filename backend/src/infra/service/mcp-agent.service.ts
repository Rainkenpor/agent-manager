import type { GovernanceData, IAgentServiceExecute, ToolCallbacks } from '@domain/entities/agent.entity.js'
import { systemPrompt } from '../../const'
import { AgentService } from './agent.service'
import { agentLogger } from './logger.service.js'

export class MCPAgentService {
	static async call(
		agent: { id: string; name: string; slug: string },
		args: { instruction: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }
	): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
		try {
			const { container } = await import('@application/container.js')
			const agentEntity = await container.getAgentUseCase.execute(agent.id)
			const agentService = new AgentService()

			if (!agentEntity.success) {
				throw new Error(`Agent not found: ${agent.id}`)
			}

			const params: IAgentServiceExecute = {
				systemPrompt: `${systemPrompt}\n${agentEntity.data.content}`,
				agentSlug: agentEntity.data.slug,
				query: args.instruction,
				allowedTools: new Set(
					Object.entries(agentEntity.data.tools)
						.filter(([_, enabled]) => enabled)
						.map(([toolName]) => toolName)
				),
				history: args.history || [],
				auditSourceType: 'tool',
				auditAgentId: agentEntity.data.id,
				auditAgentName: agentEntity.data.name,
				toolsCallbacks: {
					onToolCall: async () => {},
					draftCallbacks: { onUpdate: async () => {}, onRead: async () => null },
					credentialCallbacks: {
						getCredentials: async () => ({}),
						setCredential: async () => {},
						deleteCredential: async () => {},
						getListCredentials: async () => []
					}
				}
			}

			const response = await agentService.initAgent(params)

			console.log(`[MCP] Agent tool invoked: ${agent.slug} with instruction: ${args.instruction}`, response)

			return {
				content: [{ type: 'text' as const, text: response }]
			}
		} catch {
			return {
				content: [{ type: 'text' as const, text: `Agent ${agent.slug} unavailable` }]
			}
		}
	}

	static async *asyncCall(
		agent: { id: string; name: string; slug: string; addContext?: string },
		args: {
			instruction: string
			history?: Array<{ role: 'user' | 'assistant'; content: string }>
			toolsCallbacks?: ToolCallbacks
			userId?: string
			signal?: AbortSignal
			auditSourceType?: 'chat' | 'agent' | 'tool'
		}
	): AsyncGenerator<any> {
		try {
			const { container } = await import('@application/container.js')
			const agentEntity = await container.getAgentUseCase.execute(agent.id)
			const agentService = new AgentService()

			if (!agentEntity.success) {
				throw new Error(`Agent not found: ${agent.id}`)
			}


			const params: IAgentServiceExecute = {
				systemPrompt: `${systemPrompt}\n${agentEntity.data.content}${agent.addContext || ''}`,
				agentSlug: agentEntity.data.slug,
				query: args.instruction,
				allowedTools: new Set(
					Object.entries(agentEntity.data.tools)
						.filter(([_, enabled]) => enabled)
						.map(([toolName]) => toolName)
				),
				history: args.history || [],
				userId: args.userId,
				signal: args.signal,
				auditSourceType: args.auditSourceType ?? 'chat',
				auditAgentId: agentEntity.data.id,
				auditAgentName: agentEntity.data.name,
				toolsCallbacks: {
					...args.toolsCallbacks,
					onToolCall: args.toolsCallbacks?.onToolCall ?? (async () => {}),
					draftCallbacks: args.toolsCallbacks?.draftCallbacks ?? { onUpdate: async () => {}, onRead: async () => null },
					credentialCallbacks: args.toolsCallbacks?.credentialCallbacks ?? {
						getCredentials: async () => ({}),
						setCredential: async () => {},
						deleteCredential: async () => {},
						getListCredentials: async () => []
					},
				}
			}

			yield* agentService.initAgentStream(params)
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error)
			agentLogger.error(`[MCPAgent] asyncCall failed for agent ${agent.slug}: ${detail}`)
			throw error instanceof Error ? error : new Error(`Agent ${agent.slug} unavailable: ${detail}`)
		}
	}
}
