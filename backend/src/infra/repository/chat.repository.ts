import { AppDataSource } from '@infra/db/database.js'
import { ConversationEntity, MessageEntity } from '@infra/db/entities.js'
import { buildImageMarker, stripImageMarker } from '@infra/utils/image-marker.js'
import { In } from 'typeorm'
import { v4 as uuidv4 } from 'uuid'
import type {
	ConversationRecord,
	ConversationWithMessages,
	CreateConversationDTO,
	MessageRecord,
	PersistedImage
} from '../../domain/entities/chat.entity.js'
import type { IChatRepository } from '../../domain/repositories/chat.repository.js'

export class ChatRepository implements IChatRepository {
	private get convRepo() {
		return AppDataSource.getRepository(ConversationEntity)
	}

	private get msgRepo() {
		return AppDataSource.getRepository(MessageEntity)
	}

	async createConversation(data: CreateConversationDTO): Promise<ConversationRecord> {
		const now = new Date().toISOString()
		const entity = this.convRepo.create({
			id: uuidv4(),
			title: data.title,
			agentId: data.agentId,
			userId: data.userId,
			draft: null,
			createdAt: now,
			updatedAt: now
		})
		await this.convRepo.save(entity)
		return {
			id: entity.id,
			title: entity.title,
			agentId: entity.agentId,
			userId: entity.userId,
			draft: null,
			createdAt: now,
			updatedAt: now
		}
	}

	async findConversationsByUser(userId: string): Promise<ConversationRecord[]> {
		const rows = await this.convRepo.find({
			where: { userId },
			order: { updatedAt: 'DESC' }
		})
		return rows as ConversationRecord[]
	}

	async findConversationById(id: string): Promise<ConversationWithMessages | null> {
		const conv = await this.convRepo.findOneBy({ id })
		if (!conv) return null
		const msgs = await this.getMessages(id)
		return { ...(conv as ConversationRecord), messages: msgs }
	}

	async deleteConversation(id: string): Promise<void> {
		await this.convRepo.delete(id)
	}

	async addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<MessageRecord> {
		const createdAt = new Date().toISOString()
		const entity = this.msgRepo.create({
			id: uuidv4(),
			conversationId,
			role,
			content,
			createdAt
		})
		await this.msgRepo.save(entity)
		return { id: entity.id, conversationId, role, content, createdAt }
	}

	async findMessageById(id: string): Promise<MessageRecord | null> {
		const row = await this.msgRepo.findOneBy({ id })
		return (row as MessageRecord) ?? null
	}

	async appendMessageImages(id: string, images: PersistedImage[]): Promise<void> {
		const row = await this.msgRepo.findOneBy({ id })
		if (!row) return
		// Reemplaza cualquier marcador previo para no duplicarlo si se reintenta.
		const base = stripImageMarker(row.content)
		await this.msgRepo.update(id, { content: base + buildImageMarker(images) })
	}

	async getMessages(conversationId: string): Promise<MessageRecord[]> {
		const rows = await this.msgRepo.find({
			where: { conversationId },
			order: { createdAt: 'ASC' }
		})
		return rows as MessageRecord[]
	}

	async touchConversation(id: string): Promise<void> {
		await this.convRepo.update(id, { updatedAt: new Date().toISOString() })
	}

	async updateDraft(id: string, draft: string): Promise<void> {
		await this.convRepo.update(id, { draft })
	}

	async deleteMessagesFrom(conversationId: string, fromMessageId: string): Promise<void> {
		const msgs = await this.msgRepo.find({ where: { conversationId }, order: { createdAt: 'ASC' } })
		const idx = msgs.findIndex((m) => m.id === fromMessageId)
		if (idx === -1) return
		const idsToDelete = msgs.slice(idx).map((m) => m.id)
		await this.msgRepo.delete({ id: In(idsToDelete) })
	}
}
