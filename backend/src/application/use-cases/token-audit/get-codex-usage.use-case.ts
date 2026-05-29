import type { CodexUsage } from '@domain/entities/token-audit.entity.js'
import { codexUsageService } from '@infra/service/codex-usage.service.js'

export class GetCodexUsageUseCase {
	async execute(): Promise<{ success: true; data: CodexUsage } | { success: false; error: string }> {
		try {
			const data = await codexUsageService.getUsage()
			return { success: true, data }
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error'
			return { success: false, error: message }
		}
	}
}
