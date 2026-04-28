import { AppDataSource } from '../db/database.js'
import { GovernanceEntity } from '../db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { IGovernanceRepository } from '../../domain/repositories/governance.repository.js'
import type { GovernanceRecord, CreateGovernanceDTO, UpdateGovernanceDTO } from '../../domain/entities/governance.entity.js'

export class GovernanceRepository implements IGovernanceRepository {
	private get repo() {
		return AppDataSource.getRepository(GovernanceEntity)
	}

	private normalize(record: GovernanceEntity | null): GovernanceRecord | null {
		if (!record) return null
		return {
			...record,
			sections: record.sections ?? []
		} as GovernanceRecord
	}

	async findAll(): Promise<GovernanceRecord[]> {
		const rows = await this.repo.find({ order: { name: 'ASC' } })
		return rows.map((row) => this.normalize(row) as GovernanceRecord)
	}

	async findById(id: string): Promise<GovernanceRecord | null> {
		return this.normalize(await this.repo.findOneBy({ id }))
	}

	async findByType(type: string): Promise<GovernanceRecord[]> {
		const rows = await this.repo.find({ where: { type, isActive: true }, order: { name: 'ASC' } })
		return rows.map((row) => this.normalize(row) as GovernanceRecord)
	}

	async create(data: CreateGovernanceDTO): Promise<GovernanceRecord> {
		const now = new Date().toISOString()
		const entity = this.repo.create({ id: uuidv4(), ...data, sections: data.sections ?? [], isActive: true, createdAt: now, updatedAt: now })
		return this.normalize(await this.repo.save(entity)) as GovernanceRecord
	}

	async update(data: UpdateGovernanceDTO): Promise<GovernanceRecord | null> {
		const existing = await this.repo.findOneBy({ id: data.id })
		if (!existing) return null
		Object.assign(existing, { ...data, sections: data.sections ?? existing.sections ?? [], updatedAt: new Date().toISOString() })
		return this.normalize(await this.repo.save(existing))
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}
}
