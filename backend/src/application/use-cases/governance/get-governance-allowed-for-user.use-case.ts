import type { IGovernanceRepository } from '@domain/repositories/governance.repository.js'
import type { GovernanceRecord } from '@domain/entities/governance.entity.js'

export class GetGovernanceAllowedForUserUseCase {
	constructor(private readonly repo: IGovernanceRepository) {}

	async execute(userId: string): Promise<{ success: true; data: GovernanceRecord[] } | { success: false; error: string }> {
		try {
			const data = await this.repo.getGovernanceAllowedForUser(userId)
			return { success: true, data }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
