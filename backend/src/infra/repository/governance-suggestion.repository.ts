import { v4 as uuidv4 } from 'uuid'
import type { CreateGovernanceSuggestionDTO, GovernanceSuggestionRecord } from '../../domain/entities/governance-suggestion.entity.js'
import type { IGovernanceSuggestionRepository } from '../../domain/repositories/governance-suggestion.repository.js'
import { AppDataSource } from '../db/database.js'
import { GovernanceSuggestionEntity } from '../db/entities.js'

export class GovernanceSuggestionRepository implements IGovernanceSuggestionRepository {
	private get repo() {
		return AppDataSource.getRepository(GovernanceSuggestionEntity)
	}

	async findAll(): Promise<GovernanceSuggestionRecord[]> {
		const rows = await this.repo.find({ order: { createdAt: 'DESC' } })
		return rows as GovernanceSuggestionRecord[]
	}

	async findById(id: string): Promise<GovernanceSuggestionRecord | null> {
		return (await this.repo.findOneBy({ id })) as GovernanceSuggestionRecord | null
	}

	async findByType(type: string): Promise<GovernanceSuggestionRecord[]> {
		const rows = await this.repo.find({ where: { type }, order: { createdAt: 'DESC' } })
		return rows as GovernanceSuggestionRecord[]
	}

	async create(data: CreateGovernanceSuggestionDTO): Promise<GovernanceSuggestionRecord> {
		const entity = this.repo.create({
			id: uuidv4(),
			type: data.type,
			title: data.title,
			content: data.content,
			reason: data.reason ?? null,
			agentSlug: data.agentSlug ?? null,
			userId: data.userId ?? null,
			userEmail: data.userEmail ?? null,
			createdAt: new Date().toISOString()
		})
		return (await this.repo.save(entity)) as GovernanceSuggestionRecord
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}
}
