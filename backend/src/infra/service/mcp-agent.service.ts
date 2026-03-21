import { systemPrompt } from '../../const'
import { AgentService } from './agent.service'

export class MCPAgentService {
	static async call(
		agent: { id: string; name: string; slug: string },
		args: { instruction: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }
	): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
		// Forward to internal agent service (basic invocation — extend for streaming)
		try {
			const { container } = await import('@application/container.js')
			const agentEntity = await container.getAgentUseCase.execute(agent.id)
			const agentService = new AgentService()

			if (!agentEntity.success) {
				throw new Error(`Agent not found: ${agent.id}`)
			}
			const params = {
				systemPrompt: `${systemPrompt}\n${agentEntity.data.content}`,
				agentSlug: agentEntity.data.slug,
				query: args.instruction,
				allowedTools: new Set(
					Object.entries(agentEntity.data.tools)
						.filter(([_, enabled]) => enabled)
						.map(([toolName]) => toolName)
				),
				history: args.history || []
			}

			const response = await agentService.initAgent(params)

			console.log(`[MCP] Agent tool invoked: ${agent.slug} with instruction: ${args.instruction}`, response)

			return {
				content: [
					{
						type: 'text' as const,
						text: response
					}
				]
			}
		} catch {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Agent ${agent.slug} unavailable`
					}
				]
			}
		}
	}
	static async *asyncCall(
		agent: { id: string; name: string; slug: string },
		args: { instruction: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }
	): AsyncGenerator<any> {
		// Forward to internal agent service (basic invocation — extend for streaming)
		try {
			const { container } = await import('@application/container.js')
			const agentEntity = await container.getAgentUseCase.execute(agent.id)
			const agentService = new AgentService()

			if (!agentEntity.success) {
				throw new Error(`Agent not found: ${agent.id}`)
			}
			const params = {
				systemPrompt: `${systemPrompt}\n${agentEntity.data.content}`,
				agentSlug: agentEntity.data.slug,
				query: args.instruction,
				allowedTools: new Set(
					Object.entries(agentEntity.data.tools)
						.filter(([_, enabled]) => enabled)
						.map(([toolName]) => toolName)
				),
				history: args.history || []
			}

			// Stream
			yield* agentService.initAgentStream(params)
		} catch {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Agent ${agent.slug} unavailable`
					}
				]
			}
		}
	}
}
