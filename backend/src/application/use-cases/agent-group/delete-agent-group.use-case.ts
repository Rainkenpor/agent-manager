/*
Archivo creado con gobernanza AB900
*/

import type { IAgentGroupRepository } from '@domain/repositories/agent-group.repository.js'

const SYSTEM_GROUP_SLUGS = new Set(['traceability', 'chat'])

export class DeleteAgentGroupUseCase {
	constructor(private readonly repo: IAgentGroupRepository) {}

	async execute(id: string) {
		try {
			const group = await this.repo.findById(id)
			if (!group) return { success: false as const, error: 'Grupo no encontrado' }
			if (SYSTEM_GROUP_SLUGS.has(group.slug)) {
				return { success: false as const, error: 'No se puede eliminar un grupo del sistema' }
			}
			await this.repo.delete(id)
			return { success: true as const, data: { id } }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
