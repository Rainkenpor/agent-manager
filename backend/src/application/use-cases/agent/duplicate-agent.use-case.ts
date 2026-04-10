import type { IAgentRepository } from '@domain/repositories/agent.repository.js'
import type { AgentWithSubagents } from '@domain/entities/agent.entity.js'

export class DuplicateAgentUseCase {
	constructor(private readonly agentRepository: IAgentRepository) {}

	async execute(
		id: string,
	): Promise<{ success: true; data: AgentWithSubagents } | { success: false; error: string }> {
		try {
			const source = await this.agentRepository.findById(id)
			if (!source) return { success: false, error: 'Agent not found' }

			// Generate a unique slug: append -copy, -copy-2, -copy-3, …
			let candidateSlug = `${source.slug}-copy`
			let suffix = 1
			while (await this.agentRepository.findBySlug(candidateSlug)) {
				suffix++
				candidateSlug = `${source.slug}-copy-${suffix}`
			}

			const duplicate = await this.agentRepository.create({
				name: `${source.name} (copia)`,
				slug: candidateSlug,
				description: source.description ?? undefined,
				mode: source.mode,
				model: source.model,
				temperature: source.temperature,
				tools: source.tools as Record<string, boolean>,
				content: source.content,
				subagentIds: source.subagents.map((s) => s.id),
			})

			return { success: true, data: duplicate }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return { success: false, error: `Error al duplicar agente: ${message}` }
		}
	}
}
