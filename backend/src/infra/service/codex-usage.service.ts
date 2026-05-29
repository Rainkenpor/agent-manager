/**
 * codex-usage.service.ts — Consulta los límites de uso de Codex (ChatGPT) por curl.
 *
 * Reutiliza el token OpenAI almacenado (providerAuthService) y llama por curl al
 * endpoint de uso de Codex. Se usa curl vía child_process por requerimiento
 * explícito; no se añaden librerías HTTP nuevas.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { CodexUsage, CodexUsageWindow } from '@domain/entities/token-audit.entity.js'
import { providerAuthService } from './provider-auth.service.js'

const execFileAsync = promisify(execFile)

const USAGE_ENDPOINT = 'https://chatgpt.com/backend-api/wham/usage'

interface RawWindow {
	used_percent?: number
	limit_window_seconds?: number
	reset_after_seconds?: number
	reset_at?: number
}

interface RawUsageResponse {
	plan_type?: string
	rate_limit?: {
		limit_reached?: boolean
		primary_window?: RawWindow | null
		secondary_window?: RawWindow | null
	}
}

function decodeJwtClaims(token: string): Record<string, any> {
	const parts = token.split('.')
	if (parts.length !== 3) return {}
	try {
		return JSON.parse(Buffer.from(parts[1], 'base64url').toString())
	} catch {
		return {}
	}
}

function extractAccountId(idToken: string, accessToken: string): string {
	const claims = decodeJwtClaims(idToken || accessToken)
	return claims.chatgpt_account_id || claims['https://api.openai.com/auth']?.chatgpt_account_id || claims.organizations?.[0]?.id || ''
}

function normalizeWindow(raw: RawWindow | null | undefined): CodexUsageWindow | null {
	if (!raw || typeof raw.used_percent !== 'number') return null
	const usedPercent = raw.used_percent
	return {
		usedPercent,
		remainingPercent: Math.max(0, 100 - usedPercent),
		limitWindowSeconds: raw.limit_window_seconds ?? 0,
		resetAfterSeconds: raw.reset_after_seconds ?? 0,
		resetAt: raw.reset_at ?? 0
	}
}

export class CodexUsageService {
	async getUsage(): Promise<CodexUsage> {
		const token = await providerAuthService.getOpenAITokenResponse()
		const accessToken = token.access_token || token.accessToken
		const accountId = extractAccountId(token.id_token ?? '', accessToken)

		const { stdout } = await execFileAsync(
			'curl',
			[
				'-s',
				USAGE_ENDPOINT,
				'-H',
				`Authorization: Bearer ${accessToken}`,
				'-H',
				`ChatGPT-Account-Id: ${accountId}`,
				'-H',
				'Accept: application/json',
				'-H',
				'User-Agent: codex-cli',
				'-H',
				'Origin: https://chatgpt.com',
				'-H',
				'Referer: https://chatgpt.com/'
			],
			{ maxBuffer: 10 * 1024 * 1024 }
		)

		let parsed: RawUsageResponse
		try {
			parsed = JSON.parse(stdout) as RawUsageResponse
		} catch {
			throw new Error(`Respuesta inválida del endpoint de uso de Codex: ${stdout.slice(0, 200)}`)
		}

		const rl = parsed.rate_limit ?? {}
		return {
			planType: parsed.plan_type ?? null,
			limitReached: Boolean(rl.limit_reached),
			primaryWindow: normalizeWindow(rl.primary_window),
			secondaryWindow: normalizeWindow(rl.secondary_window)
		}
	}
}

export const codexUsageService = new CodexUsageService()
