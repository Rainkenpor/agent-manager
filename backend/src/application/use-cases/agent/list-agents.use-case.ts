import type { IAgentRepository } from "@domain/repositories/agent.repository.js";
import type { AgentWithSubagents } from "@domain/entities/agent.entity.js";

export class ListAgentsUseCase {
	agentes: Partial<AgentWithSubagents>[] = [];

	constructor(private readonly agentRepository: IAgentRepository) {}

	async execute(options?: { groupSlug?: string }): Promise<
		| { success: true; data: Partial<AgentWithSubagents>[] }
		| { success: false; error: string }
	> {
		try {
			const agents = await this.agentRepository.findAll(options);
			this.agentes = agents;
			return { success: true, data: agents };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Error desconocido";
			return { success: false, error: `Error al listar agentes: ${message}` };
		}
	}
}
