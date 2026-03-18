import type { IAgentRepository } from "@domain/repositories/agent.repository.interface.js";
import type {
	AgentWithSubagents,
	CreateAgentDTO,
} from "@domain/entities/agent.entity.js";
import { AgentSyncService } from "@applicationService/agent-sync.service.js";

export class CreateAgentUseCase {
	constructor(private readonly agentRepository: IAgentRepository) {}

	async execute(
		input: CreateAgentDTO,
	): Promise<
		| { success: true; data: AgentWithSubagents }
		| { success: false; error: string }
	> {
		try {
			const existing = await this.agentRepository.findBySlug(input.slug);
			if (existing) {
				return {
					success: false,
					error: `Ya existe un agente con el slug '${input.slug}'`,
				};
			}

			const agent = await this.agentRepository.create(input);
			await AgentSyncService.syncAgentToFile(agent);

			return { success: true, data: agent };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Error desconocido";
			return { success: false, error: `Error al crear agente: ${message}` };
		}
	}
}
