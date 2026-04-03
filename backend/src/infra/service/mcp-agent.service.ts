import { systemPrompt } from '../../const'
import { AgentService } from './agent.service'
import type { IAgentServiceExecute, SkillData, ToolCallbacks } from '@domain/entities/agent.entity.js'

/** Fetches active skills and returns both the skill list and a formatted system prompt section */
async function fetchActiveSkills(): Promise<{ skills: SkillData[]; promptSection: string }> {
	try {
		const { container } = await import('@application/container.js')
		const result = await container.listSkillsUseCase.execute()
		if (!result.success) return { skills: [], promptSection: '' }

		const active = result.data.filter((s) => s.isActive)
		if (active.length === 0) return { skills: [], promptSection: '' }

		const lines = active.map((s) => `- \`${s.slug}\`${s.description ? `: ${s.description}` : ''}`)
		const promptSection = `\n\n## Skills disponibles\n\nUsa la herramienta \`get_skill\` para cargar el contenido completo de cualquiera de estos skills antes de aplicar sus instrucciones:\n\n${lines.join('\n')}`

		return { skills: active, promptSection }
	} catch {
		return { skills: [], promptSection: '' }
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

			const { skills, promptSection } = await fetchActiveSkills()

			const params = {
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
					skillCallbacks: {
						getBySlug: async (slug: string) => skills.find((s) => s.slug === slug) ?? null,
						listSkills: async () => skills.map(({ name, slug, description }) => ({ name, slug, description }))
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
		agent: { id: string; name: string; slug: string },
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

			const { skills, promptSection } = await fetchActiveSkills()

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
					skillCallbacks: {
						getBySlug: async (slug: string) => skills.find((s) => s.slug === slug) ?? null,
						listSkills: async () => skills.map(({ name, slug, description }) => ({ name, slug, description }))
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
