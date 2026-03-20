import { db } from '../db/database.js'
import { conversations, messages } from '../db/schema.js'
import { eq, asc, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { IChatRepository } from '../../domain/repositories/chat.repository.js'
import type {
	ConversationRecord,
	ConversationWithMessages,
	CreateConversationDTO,
	MessageRecord,
} from '../../domain/entities/chat.entity.js'

export class ChatRepository implements IChatRepository {
	async createConversation(data: CreateConversationDTO): Promise<ConversationRecord> {
		const id = uuidv4()
		const now = new Date().toISOString()
		await db.insert(conversations).values({
			id,
			title: data.title,
			agentId: data.agentId,
			userId: data.userId,
			createdAt: now,
			updatedAt: now,
		})
		return { id, title: data.title, agentId: data.agentId, userId: data.userId, createdAt: now, updatedAt: now }
	}

	async findConversationsByUser(userId: string): Promise<ConversationRecord[]> {
		return db
			.select()
			.from(conversations)
			.where(eq(conversations.userId, userId))
			.orderBy(desc(conversations.updatedAt)) as Promise<ConversationRecord[]>
	}

	async findConversationById(id: string): Promise<ConversationWithMessages | null> {
		const rows = await db.select().from(conversations).where(eq(conversations.id, id))
		if (rows.length === 0) return null
		const conv = rows[0] as ConversationRecord
		const msgs = await this.getMessages(id)
		return { ...conv, messages: msgs }
	}

	async deleteConversation(id: string): Promise<void> {
		await db.delete(conversations).where(eq(conversations.id, id))
	}

	async addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<MessageRecord> {
		const id = uuidv4()
		const createdAt = new Date().toISOString()
		await db.insert(messages).values({ id, conversationId, role, content, createdAt })
		return { id, conversationId, role, content, createdAt }
	}

	async getMessages(conversationId: string): Promise<MessageRecord[]> {
		return db
			.select()
			.from(messages)
			.where(eq(messages.conversationId, conversationId))
			.orderBy(asc(messages.createdAt)) as Promise<MessageRecord[]>
	}

	async touchConversation(id: string): Promise<void> {
		await db.update(conversations).set({ updatedAt: new Date().toISOString() }).where(eq(conversations.id, id))
	}
}
