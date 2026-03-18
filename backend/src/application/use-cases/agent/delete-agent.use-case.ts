import type { IAgentRepository } from "@domain/repositories/agent.repository.interface.js";
import { AgentSyncService } from "@applicationService/agent-sync.service.js";

export class DeleteAgentUseCase {
	constructor(private readonly agentRepository: IAgentRepository) {}

	async execute(
		id: string,
	): Promise<{ success: true } | { success: false; error: string }> {
		try {
			const existing = await this.agentRepository.findById(id);
			if (!existing) {
				return { success: false, error: "Agente no encontrado" };
			}

			await this.agentRepository.delete(id);
			await AgentSyncService.deleteAgentFile(existing);

			return { success: true };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Error desconocido";
			return { success: false, error: `Error al eliminar agente: ${message}` };
		}
	}
}
