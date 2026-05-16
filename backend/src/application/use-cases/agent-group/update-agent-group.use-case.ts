/*
Archivo creado con gobernanza AB900
*/

import type { UpdateAgentGroupDTO } from '@domain/entities/agent-group.entity.js'
import type { IAgentGroupRepository } from '@domain/repositories/agent-group.repository.js'

export class UpdateAgentGroupUseCase {
	constructor(private readonly repo: IAgentGroupRepository) {}

	async execute(data: UpdateAgentGroupDTO) {
		try {
			const updated = await this.repo.update(data)
			if (!updated) return { success: false as const, error: 'Grupo no encontrado' }
			return { success: true as const, data: updated }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
