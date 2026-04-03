import type { ISkillRepository } from '@domain/repositories/skill.repository.js'
import type { SkillRecord } from '@domain/entities/skill.entity.js'

export class GetSkillUseCase {
	constructor(private readonly skillRepository: ISkillRepository) {}

	async execute(id: string): Promise<{ success: true; data: SkillRecord } | { success: false; error: string }> {
		try {
			const skill = await this.skillRepository.findById(id)
			if (!skill) return { success: false, error: 'Skill no encontrado' }
			return { success: true, data: skill }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al obtener skill: ${message}` }
		}
	}
}
