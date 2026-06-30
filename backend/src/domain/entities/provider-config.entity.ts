export type ProviderName = string

export type ProviderType = 'codex' | 'api'

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

export interface ApiProviderPayload {
	baseURL: string
	apiKey?: string
	model: string
}

export type ProviderPayload = ProviderTokenPayload | ApiProviderPayload

export interface ProviderConfig {
	id: string
	provider: ProviderName
	label: string
	type: ProviderType
	isActive: boolean
	payload: ProviderPayload
	expiresAt: string | null
	lastValidatedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface UpsertProviderConfigDTO {
	provider: ProviderName
	label?: string
	type?: ProviderType
	isActive?: boolean
	payload: ProviderPayload
	expiresAt?: string | null
	lastValidatedAt?: string | null
}

export function isApiPayload(payload: ProviderPayload): payload is ApiProviderPayload {
	return typeof (payload as ApiProviderPayload).baseURL === 'string'
}
