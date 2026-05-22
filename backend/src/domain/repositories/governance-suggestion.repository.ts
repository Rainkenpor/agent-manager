import type { CreateGovernanceSuggestionDTO, GovernanceSuggestionRecord } from '../entities/governance-suggestion.entity.js'

export interface IGovernanceSuggestionRepository {
	findAll(): Promise<GovernanceSuggestionRecord[]>
	findById(id: string): Promise<GovernanceSuggestionRecord | null>
	findByType(type: string): Promise<GovernanceSuggestionRecord[]>
	create(data: CreateGovernanceSuggestionDTO): Promise<GovernanceSuggestionRecord>
	delete(id: string): Promise<void>
}
