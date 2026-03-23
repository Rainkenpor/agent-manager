export interface McpUserCredential {
	id: string
	userId: string
	mcpServerId: string
	key: string
	value: string
	createdAt: string
	updatedAt: string
}

export interface UpsertMcpCredentialDTO {
	userId: string
	mcpServerId: string
	key: string
	value: string
}
