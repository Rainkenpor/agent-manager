import type { IGovernanceRepository } from '@domain/repositories/governance.repository.js'
import type { GovernanceRecord, UpdateGovernanceDTO } from '@domain/entities/governance.entity.js'

export class UpdateGovernanceUseCase {
	constructor(private readonly repo: IGovernanceRepository) {}

	async execute(data: UpdateGovernanceDTO): Promise<{ success: true; data: GovernanceRecord } | { success: false; error: string }> {
		try {
			const record = await this.repo.update(data)
			if (!record) return { success: false, error: 'Governance not found' }
			return { success: true, data: record }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
