export type ProviderName = 'copilot' | 'openai'

export interface ProviderTokenPayload {
	provider: ProviderName
	accessToken: string
	access_token?: string
	refresh_token?: string
	id_token?: string
	expires_in?: number
	createdAt: string
	updatedAt: string
}

export interface ProviderConfig {
	id: string
	provider: ProviderName
	payload: ProviderTokenPayload
	expiresAt: string | null
	lastValidatedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface UpsertProviderConfigDTO {
	provider: ProviderName
	payload: ProviderTokenPayload
	expiresAt?: string | null
	lastValidatedAt?: string | null
}
