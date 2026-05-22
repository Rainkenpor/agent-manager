import type { GovernanceSuggestionRecord } from '@domain/entities/governance-suggestion.entity.js'
import type { IGovernanceSuggestionRepository } from '@domain/repositories/governance-suggestion.repository.js'

export class GetGovernanceSuggestionUseCase {
	constructor(private readonly repo: IGovernanceSuggestionRepository) {}

	async execute(id: string): Promise<{ success: true; data: GovernanceSuggestionRecord } | { success: false; error: string }> {
		try {
			const data = await this.repo.findById(id)
			if (!data) return { success: false, error: 'Sugerencia no encontrada' }
			return { success: true, data }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
