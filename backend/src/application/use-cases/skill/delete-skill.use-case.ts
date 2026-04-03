import type { ISkillRepository } from '@domain/repositories/skill.repository.js'

export class DeleteSkillUseCase {
	constructor(private readonly skillRepository: ISkillRepository) {}

	async execute(id: string): Promise<{ success: true } | { success: false; error: string }> {
		try {
			const existing = await this.skillRepository.findById(id)
			if (!existing) return { success: false, error: 'Skill no encontrado' }
			await this.skillRepository.delete(id)
			return { success: true }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al eliminar skill: ${message}` }
		}
	}
}
