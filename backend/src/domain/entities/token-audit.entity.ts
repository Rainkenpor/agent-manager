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

export interface TokenMetricsPeriod {
	inputTokens: number
	outputTokens: number
	totalTokens: number
	callCount: number
}

export interface TokenMetricsByModel {
	model: string
	inputTokens: number
	outputTokens: number
	totalTokens: number
	callCount: number
}

export interface TokenDailyMetric {
	date: string // YYYY-MM-DD
	inputTokens: number
	outputTokens: number
	totalTokens: number
	callCount: number
}

export interface TokenMetrics {
	today: TokenMetricsPeriod
	currentMonth: TokenMetricsPeriod
	currentYear: TokenMetricsPeriod
	allTime: TokenMetricsPeriod
	last30Days: TokenDailyMetric[]
	byModel: TokenMetricsByModel[]
}
