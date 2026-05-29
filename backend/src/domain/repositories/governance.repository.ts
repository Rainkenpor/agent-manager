import type { CreateGovernanceDTO, GovernanceRecord, UpdateGovernanceDTO } from '../entities/governance.entity.js'

export interface IGovernanceRepository {
	findAll(): Promise<GovernanceRecord[]>
	findById(id: string): Promise<GovernanceRecord | null>
	findByType(type: string): Promise<GovernanceRecord[]>
	create(data: CreateGovernanceDTO): Promise<GovernanceRecord>
	update(data: UpdateGovernanceDTO): Promise<GovernanceRecord | null>
	delete(id: string): Promise<void>
}
