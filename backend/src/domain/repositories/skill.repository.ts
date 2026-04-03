import type { SkillRecord, CreateSkillDTO, UpdateSkillDTO } from '../entities/skill.entity.js'

export interface ISkillRepository {
	findAll(): Promise<SkillRecord[]>
	findById(id: string): Promise<SkillRecord | undefined>
	findBySlug(slug: string): Promise<SkillRecord | undefined>
	create(data: CreateSkillDTO): Promise<SkillRecord>
	update(data: UpdateSkillDTO): Promise<SkillRecord | undefined>
	delete(id: string): Promise<boolean>
	// Role ↔ Skill assignment
	assignToRole(roleId: string, skillId: string): Promise<void>
	removeFromRole(roleId: string, skillId: string): Promise<void>
	getByRole(roleId: string): Promise<SkillRecord[]>
	/** Returns skills allowed for the user based on their roles.
	 *  If no role has any skills assigned → returns all active skills (open default). */
	getSkillsAllowedForUser(userId: string): Promise<SkillRecord[]>
}
