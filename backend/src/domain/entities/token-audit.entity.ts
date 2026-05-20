export type TokenAuditSourceType = 'chat' | 'agent' | 'tool'

export interface TokenAuditRecord {
	id: string
	userId: string | null
	agentId: string | null
	llmModel: string
	inputTokens: number
	outputTokens: number
	sourceType: TokenAuditSourceType
	source: string
	createdAt: string
	updatedAt: string
}

export interface CreateTokenAuditDTO {
	userId?: string | null
	agentId?: string | null
	llmModel: string
	inputTokens: number
	outputTokens: number
	sourceType: TokenAuditSourceType
	source: string
}
