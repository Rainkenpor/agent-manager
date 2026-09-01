import { AppDataSource } from '@infra/db/database.js'
import { PresetQnaEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { CreatePresetQnaDTO, PresetQnaRecord, UpdatePresetQnaDTO } from '../../domain/entities/preset-qna.entity.js'
import type { IPresetQnaRepository } from '../../domain/repositories/preset-qna.repository.js'

export class PresetQnaRepository implements IPresetQnaRepository {
	private get repo() {
		return AppDataSource.getRepository(PresetQnaEntity)
	}

	async create(data: CreatePresetQnaDTO): Promise<PresetQnaRecord> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			canonicalQuestion: data.canonicalQuestion,
			questions: data.questions,
			answer: data.answer,
			agentSlug: data.agentSlug,
			isActive: true,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return this.toRecord(entity)
	}

	async findAll(agentSlug?: string): Promise<PresetQnaRecord[]> {
		const rows = await this.repo.find({ where: agentSlug ? { agentSlug } : {}, order: { updatedAt: 'DESC' } })
		return rows.map((r) => this.toRecord(r))
	}

	async findAllActive(): Promise<PresetQnaRecord[]> {
		const rows = await this.repo.find({ where: { isActive: true }, order: { updatedAt: 'DESC' } })
		return rows.map((r) => this.toRecord(r))
	}

	async findById(id: string): Promise<PresetQnaRecord | undefined> {
		const row = await this.repo.findOneBy({ id })
		return row ? this.toRecord(row) : undefined
	}

	async update(data: UpdatePresetQnaDTO): Promise<PresetQnaRecord | undefined> {
		const patch: Partial<PresetQnaEntity> = { updatedAt: new Date().toISOString() }
		if (data.canonicalQuestion !== undefined) patch.canonicalQuestion = data.canonicalQuestion
		if (data.questions !== undefined) patch.questions = data.questions
		if (data.answer !== undefined) patch.answer = data.answer
		if (data.isActive !== undefined) patch.isActive = data.isActive
		await this.repo.update(data.id, patch)
		return this.findById(data.id)
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.repo.delete(id)
		return (result.affected ?? 0) > 0
	}

	private toRecord(entity: PresetQnaEntity): PresetQnaRecord {
		return {
			id: entity.id,
			canonicalQuestion: entity.canonicalQuestion,
			questions: entity.questions ?? [],
			answer: entity.answer,
			agentSlug: entity.agentSlug,
			isActive: entity.isActive,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt
		}
	}
}
