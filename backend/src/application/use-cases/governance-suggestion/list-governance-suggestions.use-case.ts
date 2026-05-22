import type { GovernanceSuggestionRecord } from '@domain/entities/governance-suggestion.entity.js'
import type { IGovernanceSuggestionRepository } from '@domain/repositories/governance-suggestion.repository.js'

export class ListGovernanceSuggestionsUseCase {
	constructor(private readonly repo: IGovernanceSuggestionRepository) {}

	async execute(): Promise<{ success: true; data: GovernanceSuggestionRecord[] } | { success: false; error: string }> {
		try {
			const data = await this.repo.findAll()
			return { success: true, data }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
