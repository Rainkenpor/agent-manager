import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import nodePath from 'node:path'
import NodeCache from 'node-cache'
import type {
	ApiProviderPayload,
	ProviderConfig,
	ProviderModelConfig,
	ProviderName,
	ProviderSampling,
	ProviderTokenPayload,
	ProviderType
} from '../../domain/entities/provider-config.entity.js'
import { isApiPayload, normalizeModelConfig, normalizeSampling } from '../../domain/entities/provider-config.entity.js'
import { envs } from '../../envs.js'
import { ProviderConfigRepository } from '../repository/provider-config.repository.js'

const OPENAI_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const OPENAI_VERSION = '1.0.0'
const VALIDATION_INTERVAL_MS = 2 * 60 * 60 * 1000
const REFRESH_WINDOW_MS = 15 * 60 * 1000

interface OpenAIStartAuthState {
	codeVerifier: string
	returnTo: string
}

export interface ProviderConfigSummary {
	provider: ProviderName
	label: string
	type: ProviderType
	isActive: boolean
	configured: boolean
	hasRefreshToken: boolean
	lastValidatedAt: string | null
	expiresAt: string | null
	updatedAt: string | null
	needsRefresh: boolean
	baseURL: string | null
	model: string | null
	reasoningEffort: string | null
	sampling: ProviderSampling
}

export interface SaveApiProviderDTO {
	provider: ProviderName
	label: string
	baseURL: string
	apiKey?: string
	model: string
	sampling?: Partial<ProviderSampling>
}

function generateVerifier(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
	const bytes = randomBytes(43)
	return Array.from(bytes)
		.map((b) => chars[b % chars.length])
		.join('')
}

function generateChallenge(verifier: string): string {
	return createHash('sha256').update(verifier).digest().toString('base64url')
}

function generateState(): string {
	return randomBytes(32).toString('base64url')
}

function normalizePayload(provider: ProviderName, raw: Partial<ProviderTokenPayload> & Record<string, unknown>): ProviderTokenPayload {
	const updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString()
	const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : updatedAt
	const accessToken =
		typeof raw.accessToken === 'string' && raw.accessToken.trim()
			? raw.accessToken
			: typeof raw.access_token === 'string' && raw.access_token.trim()
				? raw.access_token
				: ''

	if (!accessToken) {
		throw new Error(`Invalid stored token for '${provider}'`)
	}

	return {
		provider,
		accessToken,
		access_token: typeof raw.access_token === 'string' ? raw.access_token : accessToken,
		refresh_token: typeof raw.refresh_token === 'string' ? raw.refresh_token : undefined,
		id_token: typeof raw.id_token === 'string' ? raw.id_token : undefined,
		expires_in: typeof raw.expires_in === 'number' ? raw.expires_in : undefined,
		createdAt,
		updatedAt
	}
}

function computeExpiresAt(payload: ProviderTokenPayload): string | null {
	if (!payload.expires_in || !Number.isFinite(payload.expires_in) || payload.expires_in <= 0) {
		return null
	}
	const baseMs = Date.parse(payload.updatedAt || payload.createdAt)
	if (Number.isNaN(baseMs)) return null
	return new Date(baseMs + payload.expires_in * 1000).toISOString()
}

function shouldRefresh(record: ProviderConfig | null, now = Date.now()): boolean {
	if (!record?.expiresAt) return false
	const expiresMs = Date.parse(record.expiresAt)
	if (Number.isNaN(expiresMs)) return false
	return expiresMs - now <= REFRESH_WINDOW_MS
}

function isValidationDue(record: ProviderConfig | null, now = Date.now()): boolean {
	if (!record?.lastValidatedAt) return true
	const validatedMs = Date.parse(record.lastValidatedAt)
	if (Number.isNaN(validatedMs)) return true
	return now - validatedMs >= VALIDATION_INTERVAL_MS
}

export class ProviderAuthService {
	private readonly repo = new ProviderConfigRepository()
	private readonly tokenCache = new NodeCache({ stdTTL: 0, useClones: false })
	private readonly authStateCache = new NodeCache({ stdTTL: 600, useClones: false })
	private readonly refreshLocks = new Map<ProviderName, Promise<ProviderConfig>>()

	private async getRecord(provider: ProviderName): Promise<ProviderConfig | null> {
		const cached = this.tokenCache.get<ProviderConfig>(provider)
		if (cached) return cached

		const record = await this.repo.findByProvider(provider)
		if (record) this.tokenCache.set(provider, record)
		return record
	}

	private async storePayload(
		provider: ProviderName,
		payloadInput: Partial<ProviderTokenPayload> & Record<string, unknown>
	): Promise<ProviderConfig> {
		const payload = normalizePayload(provider, {
			...payloadInput,
			provider,
			updatedAt: new Date().toISOString()
		})
		const record = await this.repo.upsert({
			provider,
			type: 'codex',
			label: provider === 'openai' ? 'OpenAI Codex' : provider,
			payload,
			expiresAt: computeExpiresAt(payload),
			lastValidatedAt: new Date().toISOString()
		})
		this.tokenCache.set(provider, record)
		return record
	}

	private async markValidated(record: ProviderConfig): Promise<ProviderConfig> {
		const now = new Date().toISOString()
		await this.repo.updateValidation(record.provider, now)
		const updated: ProviderConfig = {
			...record,
			lastValidatedAt: now,
			updatedAt: now
		}
		this.tokenCache.set(record.provider, updated)
		return updated
	}

	private async refreshOpenAI(record: ProviderConfig): Promise<ProviderConfig> {
		const lock = this.refreshLocks.get('openai')
		if (lock !== undefined) return lock

		const refreshPromise = (async () => {
			const refreshToken = (record.payload as ProviderTokenPayload).refresh_token
			if (!refreshToken) {
				throw new Error('OpenAI token does not include refresh_token. Reconnect the provider from Config.')
			}

			const tokenRes = await fetch('https://auth.openai.com/oauth/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'User-Agent': `opencode/${OPENAI_VERSION}`
				},
				body: new URLSearchParams({
					grant_type: 'refresh_token',
					refresh_token: refreshToken,
					client_id: OPENAI_CLIENT_ID
				})
			})

			if (!tokenRes.ok) {
				throw new Error(`OpenAI refresh error: ${tokenRes.status} ${await tokenRes.text()}`)
			}

			const tokenData = (await tokenRes.json()) as Record<string, unknown>
			return await this.storePayload('openai', {
				...record.payload,
				...tokenData,
				refresh_token: typeof tokenData.refresh_token === 'string' ? tokenData.refresh_token : refreshToken
			})
		})()

		this.refreshLocks.set('openai', refreshPromise)
		try {
			return await refreshPromise
		} finally {
			this.refreshLocks.delete('openai')
		}
	}

	private toSummary(
		record: ProviderConfig | null,
		fallbackProvider: ProviderName,
		fallbackType: ProviderType = 'codex'
	): ProviderConfigSummary {
		const apiPayload = record && isApiPayload(record.payload) ? record.payload : null
		const tokenPayload = record && !isApiPayload(record.payload) ? record.payload : null
		return {
			provider: record?.provider ?? fallbackProvider,
			label: record?.label ?? fallbackProvider,
			type: record?.type ?? fallbackType,
			isActive: Boolean(record?.isActive),
			configured: Boolean(record),
			hasRefreshToken: Boolean(tokenPayload?.refresh_token),
			lastValidatedAt: record?.lastValidatedAt ?? null,
			expiresAt: record?.expiresAt ?? null,
			updatedAt: record?.updatedAt ?? null,
			needsRefresh: shouldRefresh(record),
			baseURL: apiPayload?.baseURL ?? null,
			model: apiPayload?.model ?? record?.modelConfig?.model ?? null,
			reasoningEffort: record?.modelConfig?.reasoningEffort ?? null,
			sampling: normalizeSampling(record?.sampling)
		}
	}

	/** Modelo y esfuerzo de razonamiento del provider; sustituye a AGENT_MODEL cuando está definido. */
	async updateModelConfig(provider: ProviderName, modelConfig: Partial<ProviderModelConfig>): Promise<ProviderConfigSummary> {
		const record = await this.repo.findByProvider(provider)
		if (!record) {
			throw new Error(`Provider '${provider}' is not configured.`)
		}
		await this.repo.upsert({
			provider,
			type: record.type,
			label: record.label,
			isActive: record.isActive,
			payload: record.payload,
			sampling: record.sampling,
			modelConfig: normalizeModelConfig({ ...record.modelConfig, ...modelConfig }),
			expiresAt: record.expiresAt,
			lastValidatedAt: record.lastValidatedAt
		})
		this.tokenCache.del(provider)
		return this.getProviderSummary(provider)
	}

	/** Los parámetros de generación viven en el provider; el agente ya no los define. */
	async updateSampling(provider: ProviderName, sampling: Partial<ProviderSampling>): Promise<ProviderConfigSummary> {
		const record = await this.repo.findByProvider(provider)
		if (!record) {
			throw new Error(`Provider '${provider}' is not configured.`)
		}
		await this.repo.upsert({
			provider,
			type: record.type,
			label: record.label,
			isActive: record.isActive,
			payload: record.payload,
			sampling: normalizeSampling({ ...record.sampling, ...sampling }),
			expiresAt: record.expiresAt,
			lastValidatedAt: record.lastValidatedAt
		})
		this.tokenCache.del(provider)
		return this.getProviderSummary(provider)
	}

	async getProviderSummary(provider: ProviderName): Promise<ProviderConfigSummary> {
		const record = await this.getRecord(provider)
		return this.toSummary(record, provider)
	}

	async listProviders(): Promise<ProviderConfigSummary[]> {
		const records = await this.repo.findAll()
		return records.map((record) => this.toSummary(record, record.provider, record.type))
	}

	async getActiveProvider(): Promise<ProviderConfig | null> {
		return this.repo.findActive()
	}

	async setActiveProvider(provider: ProviderName): Promise<ProviderConfigSummary> {
		const record = await this.repo.findByProvider(provider)
		if (!record) {
			throw new Error(`Provider '${provider}' is not configured.`)
		}
		await this.repo.setActive(provider)
		this.tokenCache.flushAll()
		return this.getProviderSummary(provider)
	}

	async saveApiProvider(dto: SaveApiProviderDTO): Promise<ProviderConfigSummary> {
		const provider = dto.provider.trim()
		if (!provider) {
			throw new Error('Provider identifier is required.')
		}

		const existing = await this.repo.findByProvider(provider)

		// On edit a blank API key keeps the stored one; some providers have no key at all.
		let apiKey = dto.apiKey?.trim() ?? ''
		if (!apiKey && existing && isApiPayload(existing.payload)) apiKey = existing.payload.apiKey ?? ''

		const payload: ApiProviderPayload = {
			baseURL: dto.baseURL.trim(),
			model: dto.model.trim(),
			...(apiKey ? { apiKey } : {})
		}
		if (!payload.baseURL || !payload.model) {
			throw new Error('baseURL and model are required for an API provider.')
		}
		await this.repo.upsert({
			provider,
			type: 'api',
			label: dto.label.trim() || provider,
			payload,
			sampling: dto.sampling ? normalizeSampling({ ...existing?.sampling, ...dto.sampling }) : (existing?.sampling ?? null)
		})
		this.tokenCache.del(provider)
		return this.getProviderSummary(provider)
	}

	async beginOpenAIAuth(returnTo?: string): Promise<{ authUrl: string }> {
		const verifier = generateVerifier()
		const challenge = generateChallenge(verifier)
		const state = generateState()
		const safeReturnTo = returnTo?.trim() && returnTo.startsWith(envs.SERVER_URL) ? returnTo : `${envs.SERVER_URL}/config`
		this.authStateCache.set(state, {
			codeVerifier: verifier,
			returnTo: safeReturnTo
		} satisfies OpenAIStartAuthState)

		const params = new URLSearchParams({
			response_type: 'code',
			client_id: OPENAI_CLIENT_ID,
			redirect_uri: `http://localhost:1455/auth/callback`,
			scope: 'openid profile email offline_access',
			code_challenge: challenge,
			code_challenge_method: 'S256',
			id_token_add_organizations: 'true',
			codex_cli_simplified_flow: 'true',
			state,
			originator: 'opencode'
		})

		return {
			authUrl: `https://auth.openai.com/oauth/authorize?${params.toString()}`
		}
	}

	async completeOpenAIAuth(code: string, state: string): Promise<{ returnTo: string }> {
		const stored = this.authStateCache.get<OpenAIStartAuthState>(state)
		if (!stored) {
			throw new Error('Invalid or expired OpenAI auth state')
		}
		this.authStateCache.del(state)

		const tokenRes = await fetch('https://auth.openai.com/oauth/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': `opencode/${OPENAI_VERSION}`
			},
			body: new URLSearchParams({
				grant_type: 'authorization_code',
				code,
				redirect_uri: `${envs.SERVER_URL}/api/config/providers/openai/callback`,
				client_id: OPENAI_CLIENT_ID,
				code_verifier: stored.codeVerifier
			})
		})

		if (!tokenRes.ok) {
			throw new Error(`OpenAI token exchange error: ${tokenRes.status} ${await tokenRes.text()}`)
		}

		const tokenData = (await tokenRes.json()) as Record<string, unknown>
		await this.storePayload('openai', tokenData)
		return { returnTo: stored.returnTo }
	}

	async getOpenAITokenResponse(): Promise<ProviderTokenPayload> {
		let record = await this.getRecord('openai')
		if (!record) {
			throw new Error('OpenAI provider is not configured.')
		}

		if (shouldRefresh(record)) {
			record = await this.refreshOpenAI(record)
		} else if (isValidationDue(record)) {
			record = await this.markValidated(record)
		}

		return record.payload as ProviderTokenPayload
	}

	async getProviderAccessToken(provider: ProviderName): Promise<string> {
		if (provider === 'openai') {
			const token = await this.getOpenAITokenResponse()
			return token.access_token || token.accessToken
		}

		const record = await this.getRecord(provider)
		if (!record) {
			throw new Error(`Token for '${provider}' not found in database or legacy auth storage.`)
		}
		return (record.payload as ProviderTokenPayload).accessToken
	}

	async refreshOpenAIIfNeeded(force = false): Promise<ProviderConfigSummary> {
		// Limpieza de cache
		if (force) this.tokenCache.del('openai')

		const record = await this.getRecord('openai')
		if (!record) {
			return this.getProviderSummary('openai')
		}

		if (force || shouldRefresh(record)) {
			await this.refreshOpenAI(record)
		} else if (isValidationDue(record)) {
			await this.markValidated(record)
		}

		return this.getProviderSummary('openai')
	}

	async deleteProvider(provider: ProviderName): Promise<void> {
		this.tokenCache.del(provider)
		await this.repo.delete(provider)
	}

	async validateScheduledProviders(): Promise<void> {
		await this.refreshOpenAIIfNeeded(false)
	}
}

export const providerAuthService = new ProviderAuthService()
