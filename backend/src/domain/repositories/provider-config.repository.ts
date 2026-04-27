import type { ProviderConfig, ProviderName, UpsertProviderConfigDTO } from '../entities/provider-config.entity.js'

export interface IProviderConfigRepository {
	findByProvider(provider: ProviderName): Promise<ProviderConfig | null>
	upsert(data: UpsertProviderConfigDTO): Promise<ProviderConfig>
	updateValidation(provider: ProviderName, lastValidatedAt: string): Promise<void>
	delete(provider: ProviderName): Promise<void>
}
