import type { ProviderConfig, ProviderName, UpsertProviderConfigDTO } from '../entities/provider-config.entity.js'

export interface IProviderConfigRepository {
	findAll(): Promise<ProviderConfig[]>
	findByProvider(provider: ProviderName): Promise<ProviderConfig | null>
	findActive(): Promise<ProviderConfig | null>
	upsert(data: UpsertProviderConfigDTO): Promise<ProviderConfig>
	setActive(provider: ProviderName): Promise<void>
	updateValidation(provider: ProviderName, lastValidatedAt: string): Promise<void>
	delete(provider: ProviderName): Promise<void>
}
