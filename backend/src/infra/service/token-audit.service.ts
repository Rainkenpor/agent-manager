import { getEncoding } from 'js-tiktoken'
import type { TokenAuditSourceType } from '../../domain/entities/token-audit.entity.js'
import type { ITokenAuditRepository } from '../../domain/repositories/token-audit.repository.js'
import { agentLogger } from './logger.service.js'

export interface AuditTokenParams {
	userId?: string | null
	agentId?: string | null
	llmModel: string
	sourceType: TokenAuditSourceType
	source: string
	inputText: string
	outputText: string
	/** Tokens reales del proveedor cuando estén disponibles */
	realUsage?: { inputTokens: number; outputTokens: number }
}

class TokenAuditService {
	private enc = getEncoding('cl100k_base')

	private estimate(text: string): number {
		try {
			return this.enc.encode(text).length
		} catch {
			return Math.ceil(text.length / 4)
		}
	}

	async record(repo: ITokenAuditRepository, params: AuditTokenParams): Promise<void> {
		try {
			const inputTokens = params.realUsage?.inputTokens ?? this.estimate(params.inputText)
			const outputTokens = params.realUsage?.outputTokens ?? this.estimate(params.outputText)

			await repo.create({
				userId: params.userId ?? null,
				agentId: params.agentId ?? null,
				llmModel: params.llmModel,
				inputTokens,
				outputTokens,
				sourceType: params.sourceType,
				source: params.source
			})
		} catch (err) {
			agentLogger.warn(`[TokenAudit] Failed to record token usage: ${err instanceof Error ? err.message : String(err)}`)
		}
	}
}

export const tokenAuditService = new TokenAuditService()
