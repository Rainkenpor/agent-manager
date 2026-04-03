import type { SkillRecord, CreateSkillDTO, UpdateSkillDTO } from '../entities/skill.entity.js'

export interface ISkillRepository {
	findAll(): Promise<SkillRecord[]>
	findById(id: string): Promise<SkillRecord | undefined>
	findBySlug(slug: string): Promise<SkillRecord | undefined>
	create(data: CreateSkillDTO): Promise<SkillRecord>
	update(data: UpdateSkillDTO): Promise<SkillRecord | undefined>
	delete(id: string): Promise<boolean>
}
