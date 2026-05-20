import { v4 as uuidv4 } from 'uuid'
import type { CreateTokenAuditDTO, TokenAuditRecord } from '../../domain/entities/token-audit.entity.js'
import type { ITokenAuditRepository } from '../../domain/repositories/token-audit.repository.js'
import { AppDataSource } from '../db/database.js'
import { TokenAuditEntity } from '../db/entities.js'

export class TokenAuditRepository implements ITokenAuditRepository {
	private get repo() {
		return AppDataSource.getRepository(TokenAuditEntity)
	}

	private toRecord(entity: TokenAuditEntity): TokenAuditRecord {
		return {
			id: entity.id,
			userId: entity.userId,
			agentId: entity.agentId,
			llmModel: entity.llmModel,
			inputTokens: entity.inputTokens,
			outputTokens: entity.outputTokens,
			sourceType: entity.sourceType as TokenAuditRecord['sourceType'],
			source: entity.source,
			createdAt: entity.createdAt,
			updatedAt: entity.updatedAt
		}
	}

	async create(data: CreateTokenAuditDTO): Promise<TokenAuditRecord> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			userId: data.userId ?? null,
			agentId: data.agentId ?? null,
			llmModel: data.llmModel,
			inputTokens: data.inputTokens,
			outputTokens: data.outputTokens,
			sourceType: data.sourceType,
			source: data.source,
			createdAt: now,
			updatedAt: now
		})
		const saved = await this.repo.save(entity)
		return this.toRecord(saved)
	}

	async findAll(): Promise<TokenAuditRecord[]> {
		const entities = await this.repo.find({ order: { createdAt: 'DESC' } })
		return entities.map((e) => this.toRecord(e))
	}
}
