import type { CreateIntegrationDTO, IntegrationEntity, UpdateIntegrationDTO } from '../entities/integration.entity.js'

export interface IIntegrationRepository {
	findAll(): Promise<IntegrationEntity[]>
	findById(id: string): Promise<IntegrationEntity | null>
	findByOrigin(origin: string): Promise<IntegrationEntity | null>
	findByName(name: string): Promise<IntegrationEntity | null>
	create(data: CreateIntegrationDTO): Promise<IntegrationEntity>
	update(id: string, data: UpdateIntegrationDTO): Promise<IntegrationEntity>
	delete(id: string): Promise<void>
}
