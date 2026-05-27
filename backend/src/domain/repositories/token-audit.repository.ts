import type { CreateTokenAuditDTO, TokenAuditRecord, TokenMetrics } from '../entities/token-audit.entity.js'

export interface ITokenAuditRepository {
	create(data: CreateTokenAuditDTO): Promise<TokenAuditRecord>
	findAll(): Promise<TokenAuditRecord[]>
	getMetrics(): Promise<TokenMetrics>
}
