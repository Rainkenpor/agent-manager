import type { CreateTokenAuditDTO, TokenAuditRecord } from '../entities/token-audit.entity.js'

export interface ITokenAuditRepository {
	create(data: CreateTokenAuditDTO): Promise<TokenAuditRecord>
	findAll(): Promise<TokenAuditRecord[]>
}
