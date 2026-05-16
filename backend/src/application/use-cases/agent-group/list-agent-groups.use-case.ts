/*
Archivo creado con gobernanza AB900
*/

import type { IAgentGroupRepository } from '@domain/repositories/agent-group.repository.js'

export class ListAgentGroupsUseCase {
	constructor(private readonly repo: IAgentGroupRepository) {}

	async execute() {
		try {
			const data = await this.repo.findAll()
			return { success: true as const, data }
		} catch (error) {
			return { success: false as const, error: error instanceof Error ? error.message : 'Error desconocido' }
		}
	}
}
