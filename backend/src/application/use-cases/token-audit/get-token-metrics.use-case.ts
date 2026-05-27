import type { ITokenAuditRepository } from '@domain/repositories/token-audit.repository.js'
import type { TokenMetrics } from '@domain/entities/token-audit.entity.js'

export class GetTokenMetricsUseCase {
	constructor(private readonly repo: ITokenAuditRepository) {}

	async execute(): Promise<{ success: true; data: TokenMetrics } | { success: false; error: string }> {
		try {
			const data = await this.repo.getMetrics()
			return { success: true, data }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return { success: false, error: message }
		}
	}
}
