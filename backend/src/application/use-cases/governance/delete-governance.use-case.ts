import type { IGovernanceRepository } from '@domain/repositories/governance.repository.js'

export class DeleteGovernanceUseCase {
	constructor(private readonly repo: IGovernanceRepository) {}

	async execute(id: string): Promise<{ success: true } | { success: false; error: string }> {
		try {
			await this.repo.delete(id)
			return { success: true }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
