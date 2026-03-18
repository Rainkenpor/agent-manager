import type { IAgentRepository } from "@domain/repositories/agent.repository.interface.js";
import type {
	AgentWithSubagents,
	UpdateAgentDTO,
} from "@domain/entities/agent.entity.js";
import { AgentSyncService } from "@applicationService/agent-sync.service.js";

export class UpdateAgentUseCase {
	constructor(private readonly agentRepository: IAgentRepository) {}

	async execute(
		input: UpdateAgentDTO,
	): Promise<
		| { success: true; data: AgentWithSubagents }
		| { success: false; error: string }
	> {
		try {
			const existing = await this.agentRepository.findById(input.id);
			if (!existing) {
				return { success: false, error: "Agente no encontrado" };
			}

			if (input.slug && input.slug !== existing.slug) {
				const slugTaken = await this.agentRepository.findBySlug(input.slug);
				if (slugTaken) {
					return {
						success: false,
						error: `Ya existe un agente con el slug '${input.slug}'`,
					};
				}
				// Eliminar archivo anterior si el slug cambió
				await AgentSyncService.deleteAgentFile(existing);
			}

			const updated = await this.agentRepository.update(input);
			if (!updated) {
				return { success: false, error: "No se pudo actualizar el agente" };
			}

			await AgentSyncService.syncAgentToFile(updated);

			return { success: true, data: updated };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Error desconocido";
			return {
				success: false,
				error: `Error al actualizar agente: ${message}`,
			};
		}
	}
}
