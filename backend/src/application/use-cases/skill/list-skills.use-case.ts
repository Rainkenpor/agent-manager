import type { ISkillRepository } from '@domain/repositories/skill.repository.js'
import type { SkillRecord } from '@domain/entities/skill.entity.js'

export class ListSkillsUseCase {
	constructor(private readonly skillRepository: ISkillRepository) {}

	async execute(): Promise<{ success: true; data: SkillRecord[] } | { success: false; error: string }> {
		try {
			const skills = await this.skillRepository.findAll()
			return { success: true, data: skills }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al listar skills: ${message}` }
		}
	}
}
