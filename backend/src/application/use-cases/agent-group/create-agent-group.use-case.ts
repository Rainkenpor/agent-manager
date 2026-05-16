/*
Archivo creado con gobernanza AB900
*/

import type { CreateAgentGroupDTO } from '@domain/entities/agent-group.entity.js'
import type { IAgentGroupRepository } from '@domain/repositories/agent-group.repository.js'

export class CreateAgentGroupUseCase {
	constructor(private readonly repo: IAgentGroupRepository) {}

	async execute(data: CreateAgentGroupDTO) {
		try {
			const existing = await this.repo.findBySlug(data.slug)
			if (existing) return { success: false as const, error: `Ya existe un grupo con slug "${data.slug}"` }
			const created = await this.repo.create(data)
			return { success: true as const, data: created }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
