import type { IPresetQnaRepository } from '@domain/repositories/preset-qna.repository.js'
import { suggest } from '@infra/utils/text-match.js'

export class SuggestPresetQnaUseCase {
	constructor(private readonly repo: IPresetQnaRepository) {}

	async execute(partial: string, limit = 6): Promise<Array<{ id: string; question: string }>> {
		const text = partial?.trim()
		if (!text || text.length < 3) return []
		const groups = await this.repo.findAllActive()
		return suggest(text, groups, limit)
	}
}
