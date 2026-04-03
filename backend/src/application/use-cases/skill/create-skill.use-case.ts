import type { ISkillRepository } from '@domain/repositories/skill.repository.js'
import type { SkillRecord, CreateSkillDTO } from '@domain/entities/skill.entity.js'

export class CreateSkillUseCase {
	constructor(private readonly skillRepository: ISkillRepository) {}

	async execute(input: CreateSkillDTO): Promise<{ success: true; data: SkillRecord } | { success: false; error: string }> {
		try {
			const existing = await this.skillRepository.findBySlug(input.slug)
			if (existing) {
				return { success: false, error: `Ya existe un skill con el slug '${input.slug}'` }
			}
			const skill = await this.skillRepository.create(input)
			return { success: true, data: skill }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Error desconocido'
			return { success: false, error: `Error al crear skill: ${message}` }
		}
	}
}
