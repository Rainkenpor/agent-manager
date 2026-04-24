import type { AgentWithSubagents } from '@domain/entities/agent.entity.js'
import type { IAgentRepository } from '@domain/repositories'

export class GetAgentUseCase {
	constructor(private readonly agentRepository: IAgentRepository) {}

	async execute(id: string): Promise<{ success: true; data: AgentWithSubagents } | { success: false; error: string }> {
		try {
			const agent = await this.agentRepository.findById(id)
			if (!agent) {
				return { success: false, error: 'Agente no encontrado' }
			}
			return { success: true, data: agent }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al obtener agente: ${message}` }
		}
	}
}
