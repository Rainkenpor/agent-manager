import type { IGovernanceSuggestionRepository } from '@domain/repositories/governance-suggestion.repository.js'

export class DeleteGovernanceSuggestionUseCase {
	constructor(private readonly repo: IGovernanceSuggestionRepository) {}

	async execute(id: string): Promise<{ success: true } | { success: false; error: string }> {
		try {
			await this.repo.delete(id)
			return { success: true }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
