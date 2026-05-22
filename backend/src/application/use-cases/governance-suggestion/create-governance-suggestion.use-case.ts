import type { CreateGovernanceSuggestionDTO, GovernanceSuggestionRecord } from '@domain/entities/governance-suggestion.entity.js'
import type { IGovernanceSuggestionRepository } from '@domain/repositories/governance-suggestion.repository.js'

export class CreateGovernanceSuggestionUseCase {
	constructor(private readonly repo: IGovernanceSuggestionRepository) {}

	async execute(
		data: CreateGovernanceSuggestionDTO
	): Promise<{ success: true; data: GovernanceSuggestionRecord } | { success: false; error: string }> {
		try {
			const record = await this.repo.create(data)
			return { success: true, data: record }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
