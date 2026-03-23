import type { IMcpUserCredentialRepository } from '@domain/repositories/mcp-user-credential.repository.js'

export class DeleteMcpCredentialUseCase {
	constructor(private readonly repo: IMcpUserCredentialRepository) {}

	async execute(
		userId: string,
		mcpServerId: string,
		key: string
	): Promise<{ success: true } | { success: false; error: string }> {
		try {
			await this.repo.delete(userId, mcpServerId, key)
			return { success: true }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
