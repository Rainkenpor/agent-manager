import { v4 as uuidv4 } from 'uuid'
import type {
	CreateTokenAuditDTO,
	TokenAuditRecord,
	TokenDailyMetric,
	TokenMetrics,
	TokenMetricsByModel,
	TokenMetricsPeriod
} from '../../domain/entities/token-audit.entity.js'
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

	async getMetrics(): Promise<TokenMetrics> {
		const all = await this.repo.find({ order: { createdAt: 'ASC' } })

		const now = new Date()
		const todayStr = now.toISOString().slice(0, 10)
		const monthStr = now.toISOString().slice(0, 7)
		const yearStr = now.toISOString().slice(0, 4)

		const zero = (): TokenMetricsPeriod => ({ inputTokens: 0, outputTokens: 0, totalTokens: 0, callCount: 0 })
		const add = (acc: TokenMetricsPeriod, e: TokenAuditEntity) => {
			acc.inputTokens += e.inputTokens
			acc.outputTokens += e.outputTokens
			acc.totalTokens += e.inputTokens + e.outputTokens
			acc.callCount++
		}

		const today = zero()
		const currentMonth = zero()
		const currentYear = zero()
		const allTime = zero()

		for (const e of all) {
			const d = e.createdAt.slice(0, 10)
			const m = e.createdAt.slice(0, 7)
			const y = e.createdAt.slice(0, 4)
			if (d === todayStr) add(today, e)
			if (m === monthStr) add(currentMonth, e)
			if (y === yearStr) add(currentYear, e)
			add(allTime, e)
		}

		// last 30 days array
		const last30Days: TokenDailyMetric[] = []
		const dayMap = new Map<string, TokenDailyMetric>()
		for (let i = 29; i >= 0; i--) {
			const d = new Date(now)
			d.setDate(d.getDate() - i)
			const ds = d.toISOString().slice(0, 10)
			const entry: TokenDailyMetric = { date: ds, inputTokens: 0, outputTokens: 0, totalTokens: 0, callCount: 0 }
			last30Days.push(entry)
			dayMap.set(ds, entry)
		}
		for (const e of all) {
			const d = e.createdAt.slice(0, 10)
			const entry = dayMap.get(d)
			if (entry) {
				entry.inputTokens += e.inputTokens
				entry.outputTokens += e.outputTokens
				entry.totalTokens += e.inputTokens + e.outputTokens
				entry.callCount++
			}
		}

		// by model
		const modelMap = new Map<string, TokenMetricsByModel>()
		for (const e of all) {
			let m = modelMap.get(e.llmModel)
			if (!m) {
				m = { model: e.llmModel, inputTokens: 0, outputTokens: 0, totalTokens: 0, callCount: 0 }
				modelMap.set(e.llmModel, m)
			}
			m.inputTokens += e.inputTokens
			m.outputTokens += e.outputTokens
			m.totalTokens += e.inputTokens + e.outputTokens
			m.callCount++
		}

		return { today, currentMonth, currentYear, allTime, last30Days, byModel: [...modelMap.values()] }
	}
}
