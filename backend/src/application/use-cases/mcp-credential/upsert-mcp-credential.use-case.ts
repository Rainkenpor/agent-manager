import type { IMcpUserCredentialRepository } from '@domain/repositories/mcp-user-credential.repository.js'
import type { McpUserCredential, UpsertMcpCredentialDTO } from '@domain/entities/mcp-user-credential.entity.js'

export class UpsertMcpCredentialUseCase {
	constructor(private readonly repo: IMcpUserCredentialRepository) {}

	async execute(
		data: UpsertMcpCredentialDTO
	): Promise<{ success: true; data: McpUserCredential } | { success: false; error: string }> {
		try {
			const credential = await this.repo.upsert(data)
			return { success: true, data: credential }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
