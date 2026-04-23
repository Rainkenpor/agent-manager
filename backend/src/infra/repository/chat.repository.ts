import { AppDataSource } from '@infra/db/database.js'
import { ConversationEntity, MessageEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { IChatRepository } from '../../domain/repositories/chat.repository.js'
import type { ConversationRecord, ConversationWithMessages, CreateConversationDTO, MessageRecord } from '../../domain/entities/chat.entity.js'

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
		return { id: entity.id, title: entity.title, agentId: entity.agentId, userId: entity.userId, draft: null, createdAt: now, updatedAt: now }
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
}
