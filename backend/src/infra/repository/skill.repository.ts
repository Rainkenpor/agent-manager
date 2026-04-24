import { AppDataSource } from '@infra/db/database.js'
import { SkillEntity, RoleSkillEntity, UserRoleEntity } from '@infra/db/entities.js'
import { In } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import type { ISkillRepository } from '../../domain/repositories/skill.repository.js'
import type { SkillRecord, CreateSkillDTO, UpdateSkillDTO } from '../../domain/entities/skill.entity.js'

export class SkillRepository implements ISkillRepository {
	private get repo() {
		return AppDataSource.getRepository(SkillEntity)
	}

	private toRecord(e: SkillEntity): SkillRecord {
		return { ...e }
	}

	async findAll(): Promise<SkillRecord[]> {
		const rows = await this.repo.find({ order: { name: 'ASC' } })
		return rows.map((r) => this.toRecord(r))
	}

	async findById(id: string): Promise<SkillRecord | undefined> {
		const row = await this.repo.findOneBy({ id })
		return row ? this.toRecord(row) : undefined
	}

	async findBySlug(slug: string): Promise<SkillRecord | undefined> {
		const row = await this.repo.findOneBy({ slug })
		return row ? this.toRecord(row) : undefined
	}

	async create(data: CreateSkillDTO): Promise<SkillRecord> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			name: data.name,
			slug: data.slug,
			description: data.description ?? null,
			content: data.content,
			isActive: true,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return (await this.findById(entity.id))!
	}

	async update(data: UpdateSkillDTO): Promise<SkillRecord | undefined> {
		const updateValues: Partial<SkillEntity> = { updatedAt: new Date().toISOString() }
		if (data.name !== undefined) updateValues.name = data.name
		if (data.slug !== undefined) updateValues.slug = data.slug
		if (data.description !== undefined) updateValues.description = data.description
		if (data.content !== undefined) updateValues.content = data.content
		if (data.isActive !== undefined) updateValues.isActive = data.isActive
		await this.repo.update(data.id, updateValues)
		return this.findById(data.id)
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.repo.delete(id)
		return (result.affected ?? 0) > 0
	}

	async assignToRole(roleId: string, skillId: string): Promise<void> {
		const repo = AppDataSource.getRepository(RoleSkillEntity)
		const existing = await repo.findOneBy({ roleId, skillId })
		if (existing) return
		await repo.save(repo.create({ id: uuidv4(), roleId, skillId, assignedAt: new Date().toISOString() }))
	}

	async removeFromRole(roleId: string, skillId: string): Promise<void> {
		const repo = AppDataSource.getRepository(RoleSkillEntity)
		await repo.delete({ roleId, skillId })
	}

	async getByRole(roleId: string): Promise<SkillRecord[]> {
		const rsRepo = AppDataSource.getRepository(RoleSkillEntity)
		const relations = await rsRepo.findBy({ roleId })
		if (!relations.length) return []
		const skillIds = relations.map((r) => r.skillId)
		const rows = await this.repo.find({ where: { id: In(skillIds) }, order: { name: 'ASC' } })
		return rows.map((r) => this.toRecord(r))
	}

	async getSkillsAllowedForUser(userId: string): Promise<SkillRecord[]> {
		const urRepo = AppDataSource.getRepository(UserRoleEntity)
		const userRoles = await urRepo.findBy({ userId })
		const roleIds = userRoles.map((r) => r.roleId)
		if (!roleIds.length) return []

		const rsRepo = AppDataSource.getRepository(RoleSkillEntity)
		const relations = await rsRepo.findBy({ roleId: In(roleIds) })
		if (!relations.length) return []

		const skillIds = [...new Set(relations.map((r) => r.skillId))]
		const rows = await this.repo.find({
			where: { id: In(skillIds), isActive: true },
			order: { name: 'ASC' }
		})
		return rows.map((r) => this.toRecord(r))
	}
}
