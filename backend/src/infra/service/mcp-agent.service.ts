import { systemPrompt } from '../../const'
import { AgentService } from './agent.service'
import type { GovernanceData, IAgentServiceExecute, ToolCallbacks } from '@domain/entities/agent.entity.js'

async function fetchActiveGovernance(): Promise<{ governance: GovernanceData[]; promptSection: string }> {
	try {
		const { container } = await import('@application/container.js')
		const result = await container.listGovernanceUseCase.execute()
		if (!result.success) return { governance: [], promptSection: '' }
		const active: GovernanceData[] = result.data.filter((g) => g.isActive)

		if (active.length === 0) return { governance: [], promptSection: '' }

		const types = [...new Set(active.map((g) => g.type))]
		const lines = types.map((t) => `- \`${t}\``)
		const promptSection = `\n\n## Gobernanza disponible\n\nUsa la herramienta \`get_governance\` con el tipo correspondiente para cargar las instrucciones de gobernanza antes de proceder. Tipos disponibles:\n\n${lines.join('\n')}`

		return { governance: active, promptSection }
	} catch {
		return { governance: [], promptSection: '' }
	}
}

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

			const { governance, promptSection } = await fetchActiveGovernance()

			const params: IAgentServiceExecute = {
				systemPrompt: `${systemPrompt}\n${agentEntity.data.content}${promptSection}`,
				agentSlug: agentEntity.data.slug,
				query: args.instruction,
				allowedTools: new Set(
					Object.entries(agentEntity.data.tools)
						.filter(([_, enabled]) => enabled)
						.map(([toolName]) => toolName)
				),
				history: args.history || [],
				toolsCallbacks: {
					onToolCall: async () => {},
					draftCallbacks: { onUpdate: async () => {}, onRead: async () => null },
					credentialCallbacks: {
						getCredentials: async () => ({}),
						setCredential: async () => {},
						deleteCredential: async () => {},
						getListCredentials: async () => []
					},
					governanceCallbacks: {
						getByType: async (type: string) => governance.filter((g) => g.type === type),
						listTypes: async () => [...new Set(governance.map((g) => g.type))]
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
		}
	): AsyncGenerator<any> {
		try {
			const { container } = await import('@application/container.js')
			const agentEntity = await container.getAgentUseCase.execute(agent.id)
			const agentService = new AgentService()

			if (!agentEntity.success) {
				throw new Error(`Agent not found: ${agent.id}`)
			}

			const { governance, promptSection } = await fetchActiveGovernance()

			const params: IAgentServiceExecute = {
				systemPrompt: `${systemPrompt}\n${agentEntity.data.content}${agent.addContext || ''}${promptSection}`,
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
					governanceCallbacks: {
						getByType: async (type: string) => governance.filter((g) => g.type === type),
						listTypes: async () => [...new Set(governance.map((g) => g.type))]
					}
				}
			}

			yield* agentService.initAgentStream(params)
		} catch {
			return {
				content: [{ type: 'text' as const, text: `Agent ${agent.slug} unavailable` }]
			}
		}
	}
}
