/**
 * codex-models.service.ts — Catálogo de modelos de Codex (ChatGPT).
 *
 * Consulta el mismo endpoint que usa el CLI oficial de Codex:
 *   GET https://chatgpt.com/backend-api/codex/models?client_version=<v>
 * y devuelve `{ models: [{ slug, display_name, supported_reasoning_levels, ... }] }`.
 * Reutiliza el token OAuth almacenado en providerAuthService.
 */
import type { CodexModel, ReasoningEffortOption } from '@domain/entities/provider-config.entity.js'
import NodeCache from 'node-cache'
import { extractAccountId } from './codex-usage.service.js'
import { providerAuthService } from './provider-auth.service.js'

const MODELS_ENDPOINT = 'https://chatgpt.com/backend-api/codex/models'
/**
 * El backend filtra el catálogo por esta versión: oculta todo modelo cuyo `minimal_client_version`
 * la supere, así que una versión baja devuelve `{"models":[]}`. Se declara la del CLI de Codex
 * estable más reciente; hay que subirla cuando OpenAI publique modelos que exijan una mayor.
 */
const CLIENT_VERSION = '0.150.1'
const CACHE_KEY = 'codex:models'
/** El catálogo cambia con muy poca frecuencia; el botón "Recargar catálogo" fuerza la consulta. */
const CACHE_TTL_SECONDS = 8 * 60 * 60

interface RawReasoningLevel {
	effort?: string
	description?: string
}

interface RawModel {
	slug?: string
	display_name?: string
	description?: string | null
	default_reasoning_level?: string | null
	supported_reasoning_levels?: RawReasoningLevel[]
	visibility?: string
	priority?: number
	context_window?: number | null
}

interface RawModelsResponse {
	models?: RawModel[]
}

/** El backend de Codex devuelve los fallos como { error: { message } }; se prefiere ese texto al cuerpo crudo. */
function describeError(body: string): string {
	try {
		const parsed = JSON.parse(body) as { error?: { message?: string }; detail?: { message?: string } }
		return parsed.error?.message ?? parsed.detail?.message ?? body.slice(0, 200)
	} catch {
		return body.slice(0, 200)
	}
}

function toEfforts(raw: RawReasoningLevel[] | undefined): ReasoningEffortOption[] {
	if (!Array.isArray(raw)) return []
	return raw
		.filter((level): level is RawReasoningLevel & { effort: string } => typeof level.effort === 'string' && level.effort.length > 0)
		.map((level) => ({ effort: level.effort, description: level.description ?? level.effort }))
}

export class CodexModelsService {
	private readonly cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, useClones: false })

	private async fetchCatalog(): Promise<{ response: Response; body: string }> {
		const token = await providerAuthService.getOpenAITokenResponse()
		const accessToken = token.access_token || token.accessToken
		const accountId = extractAccountId(token.id_token ?? '', accessToken)

		const response = await fetch(`${MODELS_ENDPOINT}?client_version=${CLIENT_VERSION}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'ChatGPT-Account-Id': accountId,
				Accept: 'application/json',
				originator: 'codex_cli_rs',
				'User-Agent': `codex_cli_rs/${CLIENT_VERSION}`
			}
		})

		return { response, body: await response.text() }
	}

	async listModels(force = false): Promise<CodexModel[]> {
		if (force) this.cache.del(CACHE_KEY)
		const cached = this.cache.get<CodexModel[]>(CACHE_KEY)
		if (cached) return cached

		// Un token guardado sin `expires_in` nunca entra en la ventana de refresco, así que puede llegar
		// caducado aquí; ante un 401 se fuerza el refresh y se reintenta una vez.
		let { response, body } = await this.fetchCatalog()
		if (response.status === 401) {
			await providerAuthService.refreshOpenAIIfNeeded(true)
			;({ response, body } = await this.fetchCatalog())
		}

		if (!response.ok) {
			throw new Error(`No fue posible obtener los modelos de Codex (${response.status}): ${describeError(body)}`)
		}

		let parsed: RawModelsResponse
		try {
			parsed = JSON.parse(body) as RawModelsResponse
		} catch {
			throw new Error(`Respuesta inválida del catálogo de modelos de Codex: ${body.slice(0, 200)}`)
		}

		// `visibility` distingue los modelos del selector ('list') de los internos ('hide', p. ej.
		// codex-auto-review). `priority` es ascendente: 1 es el modelo principal.
		const models = (parsed.models ?? [])
			.filter((model): model is RawModel & { slug: string } => typeof model.slug === 'string' && model.visibility === 'list')
			.sort((a, b) => (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER))
			.map<CodexModel>((model) => ({
				slug: model.slug,
				displayName: model.display_name || model.slug,
				description: model.description ?? null,
				defaultEffort: model.default_reasoning_level ?? null,
				efforts: toEfforts(model.supported_reasoning_levels),
				contextWindow: model.context_window ?? null
			}))

		this.cache.set(CACHE_KEY, models)
		return models
	}
}

export const codexModelsService = new CodexModelsService()
