import { db } from '../db/database.js'
import { skills } from '../db/schema.js'
import { eq, asc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { ISkillRepository } from '../../domain/repositories/skill.repository.js'
import type { SkillRecord, CreateSkillDTO, UpdateSkillDTO } from '../../domain/entities/skill.entity.js'

export class SkillRepository implements ISkillRepository {
	private toRecord(row: typeof skills.$inferSelect): SkillRecord {
		return { ...row }
	}

	async findAll(): Promise<SkillRecord[]> {
		const rows = await db.select().from(skills).orderBy(asc(skills.name))
		return rows.map((r) => this.toRecord(r))
	}

	async findById(id: string): Promise<SkillRecord | undefined> {
		const rows = await db.select().from(skills).where(eq(skills.id, id)).limit(1)
		return rows[0] ? this.toRecord(rows[0]) : undefined
	}

	async findBySlug(slug: string): Promise<SkillRecord | undefined> {
		const rows = await db.select().from(skills).where(eq(skills.slug, slug)).limit(1)
		return rows[0] ? this.toRecord(rows[0]) : undefined
	}

	async create(data: CreateSkillDTO): Promise<SkillRecord> {
		const id = uuidv4()
		const now = new Date().toISOString()
		await db.insert(skills).values({
			id,
			name: data.name,
			slug: data.slug,
			description: data.description ?? null,
			content: data.content,
			isActive: true,
			createdAt: now,
			updatedAt: now,
		})
		return (await this.findById(id))!
	}

	async update(data: UpdateSkillDTO): Promise<SkillRecord | undefined> {
		const now = new Date().toISOString()
		const updateValues: Partial<typeof skills.$inferInsert> = { updatedAt: now }

		if (data.name !== undefined) updateValues.name = data.name
		if (data.slug !== undefined) updateValues.slug = data.slug
		if (data.description !== undefined) updateValues.description = data.description
		if (data.content !== undefined) updateValues.content = data.content
		if (data.isActive !== undefined) updateValues.isActive = data.isActive

		await db.update(skills).set(updateValues).where(eq(skills.id, data.id))
		return this.findById(data.id)
	}

	async delete(id: string): Promise<boolean> {
		const result = await db.delete(skills).where(eq(skills.id, id))
		return result.changes > 0
	}
}
