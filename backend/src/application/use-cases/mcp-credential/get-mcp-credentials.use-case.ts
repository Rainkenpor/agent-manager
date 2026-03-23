import type { IMcpUserCredentialRepository } from '@domain/repositories/mcp-user-credential.repository.js'
import type { McpUserCredential } from '@domain/entities/mcp-user-credential.entity.js'

export class GetMcpCredentialsUseCase {
	constructor(private readonly repo: IMcpUserCredentialRepository) {}

	async execute(
		userId: string,
		mcpServerId?: string
	): Promise<{ success: true; data: McpUserCredential[] } | { success: false; error: string }> {
		try {
			const data = mcpServerId
				? await this.repo.findByUserAndMcp(userId, mcpServerId)
				: await this.repo.findByUser(userId)
			return { success: true, data }
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
		}
	}
}
