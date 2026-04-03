import type { ISkillRepository } from '@domain/repositories/skill.repository.js'
import type { SkillRecord, UpdateSkillDTO } from '@domain/entities/skill.entity.js'

export class UpdateSkillUseCase {
	constructor(private readonly skillRepository: ISkillRepository) {}

	async execute(input: UpdateSkillDTO): Promise<{ success: true; data: SkillRecord } | { success: false; error: string }> {
		try {
			const existing = await this.skillRepository.findById(input.id)
			if (!existing) return { success: false, error: 'Skill no encontrado' }

			if (input.slug && input.slug !== existing.slug) {
				const slugTaken = await this.skillRepository.findBySlug(input.slug)
				if (slugTaken) {
					return { success: false, error: `Ya existe un skill con el slug '${input.slug}'` }
				}
			}

			const updated = await this.skillRepository.update(input)
			if (!updated) return { success: false, error: 'No se pudo actualizar el skill' }
			return { success: true, data: updated }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al actualizar skill: ${message}` }
		}
	}
}
