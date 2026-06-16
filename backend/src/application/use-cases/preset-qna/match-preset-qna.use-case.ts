import type { PresetQnaRecord } from '@domain/entities/preset-qna.entity.js'
import type { IPresetQnaRepository } from '@domain/repositories/preset-qna.repository.js'
import { findBestMatch, MATCH_THRESHOLD } from '@infra/utils/text-match.js'

export class MatchPresetQnaUseCase {
	constructor(private readonly repo: IPresetQnaRepository) {}

	async execute(query: string): Promise<PresetQnaRecord | null> {
		const text = query?.trim()
		if (!text) return null
		const groups = await this.repo.findAllActive()
		const best = findBestMatch(text, groups)
		if (best && best.score >= MATCH_THRESHOLD) return best.group
		return null
	}
}
