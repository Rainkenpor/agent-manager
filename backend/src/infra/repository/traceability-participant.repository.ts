/*
Archivo creado con gobernanza AB900
*/

import { AppDataSource } from '@infra/db/database.js'
import { ConversationEntity, TraceabilityEntity, TraceabilityParticipantEntity } from '@infra/db/entities.js'
import { In } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import type {
	CreateTraceabilityParticipantDTO,
	TraceabilityInvitation,
	TraceabilityParticipant
} from '../../domain/entities/traceability-participant.entity.js'
import type { ITraceabilityParticipantRepository } from '../../domain/repositories/traceability-participant.repository.js'

function toDomain(e: TraceabilityParticipantEntity): TraceabilityParticipant {
	return {
		id: e.id,
		traceabilityId: e.traceabilityId,
		userId: e.userId,
		chatId: e.chatId ?? null,
		invitedBy: e.invitedBy,
		createdAt: e.createdAt
	}
}

export class TraceabilityParticipantRepository implements ITraceabilityParticipantRepository {
	private get repo() {
		return AppDataSource.getRepository(TraceabilityParticipantEntity)
	}

	async add(data: CreateTraceabilityParticipantDTO): Promise<TraceabilityParticipant> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: uuidv4(),
			traceabilityId: data.traceabilityId,
			userId: data.userId,
			chatId: null,
			invitedBy: data.invitedBy,
			createdAt: now
		})
		const saved = await this.repo.save(entity)
		return toDomain(saved)
	}

	async removeByUser(traceabilityId: string, userId: string): Promise<void> {
		await this.repo.delete({ traceabilityId, userId })
	}

	async listByTraceability(traceabilityId: string): Promise<TraceabilityParticipant[]> {
		const rows = await this.repo.findBy({ traceabilityId })
		return rows.map(toDomain)
	}

	async listByUser(userId: string): Promise<TraceabilityParticipant[]> {
		const rows = await this.repo.findBy({ userId })
		return rows.map(toDomain)
	}

	async findOne(traceabilityId: string, userId: string): Promise<TraceabilityParticipant | null> {
		const row = await this.repo.findOneBy({ traceabilityId, userId })
		return row ? toDomain(row) : null
	}

	async setChatId(id: string, chatId: string | null): Promise<void> {
		await this.repo.update(id, { chatId })
	}

	async listInvitationsForUser(userId: string): Promise<TraceabilityInvitation[]> {
		const rows = await this.repo.findBy({ userId })
		if (rows.length === 0) return []

		const tracRepo = AppDataSource.getRepository(TraceabilityEntity)
		const convRepo = AppDataSource.getRepository(ConversationEntity)

		const traceabilityIds = Array.from(new Set(rows.map((r) => r.traceabilityId)))
		const tracs = await tracRepo.findBy({ id: In(traceabilityIds) })
		const tracById = new Map(tracs.map((t) => [t.id, t]))

		const originatingChatIds = tracs.map((t) => t.chatId).filter((id): id is string => !!id)
		const originatingChats = originatingChatIds.length ? await convRepo.findBy({ id: In(originatingChatIds) }) : []
		const agentByChatId = new Map(originatingChats.map((c) => [c.id, c.agentId]))

		return rows.map((r) => {
			const t = tracById.get(r.traceabilityId)
			const agentId = t?.chatId ? (agentByChatId.get(t.chatId) ?? null) : null
			return {
				traceabilityId: r.traceabilityId,
				title: t?.title ?? '',
				description: t?.description ?? null,
				chatId: r.chatId ?? null,
				agentId,
				createdAt: r.createdAt
			}
		})
	}
}
