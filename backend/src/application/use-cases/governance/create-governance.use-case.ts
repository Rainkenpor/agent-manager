import type { IGovernanceRepository } from '@domain/repositories/governance.repository.js'
import type { GovernanceRecord, CreateGovernanceDTO } from '@domain/entities/governance.entity.js'

export class CreateGovernanceUseCase {
	constructor(private readonly repo: IGovernanceRepository) {}

	async execute(data: CreateGovernanceDTO): Promise<{ success: true; data: GovernanceRecord } | { success: false; error: string }> {
		try {
			const record = await this.repo.create(data)
			return { success: true, data: record }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
