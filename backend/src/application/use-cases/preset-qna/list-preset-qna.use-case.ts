import type { PresetQnaRecord } from '@domain/entities/preset-qna.entity.js'
import type { IPresetQnaRepository } from '@domain/repositories/preset-qna.repository.js'

export class ListPresetQnaUseCase {
	constructor(private readonly repo: IPresetQnaRepository) {}

	async execute(agentSlug?: string): Promise<{ success: true; data: PresetQnaRecord[] } | { success: false; error: string }> {
		try {
			const data = await this.repo.findAll(agentSlug)
			return { success: true, data }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al listar preguntas: ${message}` }
		}
	}
}
