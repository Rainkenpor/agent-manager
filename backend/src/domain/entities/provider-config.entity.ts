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

export type SamplingMode = 'thinking' | 'instruct'

/**
 * Parámetros de muestreo enviados al LLM. Mapa abierto a propósito: cada modelo expone los suyos
 * (top_k, min_p, repetition_penalty…) y se envían tal cual en el cuerpo de la petición.
 */
export type SamplingParams = Record<string, number | string | boolean>

/** Configuración de generación del provider: sustituye a la que antes vivía en cada agente. */
export interface ProviderSampling {
	defaultMode: SamplingMode
	thinking: SamplingParams
	instruct: SamplingParams
}

export const DEFAULT_SAMPLING: ProviderSampling = {
	defaultMode: 'instruct',
	thinking: { temperature: 1.0, top_p: 0.95, top_k: 20, min_p: 0.0, presence_penalty: 0.0, repetition_penalty: 1.0 },
	instruct: { temperature: 0.7, top_p: 0.8, top_k: 20, min_p: 0.0, presence_penalty: 1.5, repetition_penalty: 1.0 }
}

export function normalizeSampling(raw: Partial<ProviderSampling> | null | undefined): ProviderSampling {
	return {
		defaultMode: raw?.defaultMode === 'thinking' ? 'thinking' : 'instruct',
		thinking: { ...DEFAULT_SAMPLING.thinking, ...(raw?.thinking ?? {}) },
		instruct: { ...DEFAULT_SAMPLING.instruct, ...(raw?.instruct ?? {}) }
	}
}

/** Parámetros efectivos para una llamada, según el modo pedido o el del provider. */
export function resolveSamplingParams(sampling: ProviderSampling | null | undefined, mode?: SamplingMode): SamplingParams {
	const normalized = normalizeSampling(sampling)
	return { ...normalized[mode ?? normalized.defaultMode] }
}

export interface ProviderConfig {
	id: string
	provider: ProviderName
	label: string
	type: ProviderType
	isActive: boolean
	payload: ProviderPayload
	sampling: ProviderSampling | null
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
	sampling?: ProviderSampling | null
	expiresAt?: string | null
	lastValidatedAt?: string | null
}

export function isApiPayload(payload: ProviderPayload): payload is ApiProviderPayload {
	return typeof (payload as ApiProviderPayload).baseURL === 'string'
}
