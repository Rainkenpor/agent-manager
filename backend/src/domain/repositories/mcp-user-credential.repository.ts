import type { McpUserCredential, UpsertMcpCredentialDTO } from '../entities/mcp-user-credential.entity.js'

export interface IMcpUserCredentialRepository {
	findByUserAndMcp(userId: string, mcpServerId: string): Promise<McpUserCredential[]>
	findByUser(userId: string): Promise<McpUserCredential[]>
	upsert(data: UpsertMcpCredentialDTO): Promise<McpUserCredential>
	delete(userId: string, mcpServerId: string, key: string): Promise<void>
}
