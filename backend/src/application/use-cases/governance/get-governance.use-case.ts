import type { GovernanceRecord } from '@domain/entities/governance.entity.js'
import type { IGovernanceRepository } from '@domain/repositories/governance.repository.js'

export class GetGovernanceUseCase {
	constructor(private readonly repo: IGovernanceRepository) {}

	async execute(id: string): Promise<{ success: true; data: GovernanceRecord } | { success: false; error: string }> {
		try {
			const data = await this.repo.findById(id)
			if (!data) return { success: false, error: 'Governance not found' }
			return { success: true, data }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
