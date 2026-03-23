import type {
	ConversationRecord,
	ConversationWithMessages,
	CreateConversationDTO,
	MessageRecord,
} from '../entities/chat.entity.js'

export interface IChatRepository {
	createConversation(data: CreateConversationDTO): Promise<ConversationRecord>
	findConversationsByUser(userId: string): Promise<ConversationRecord[]>
	findConversationById(id: string): Promise<ConversationWithMessages | null>
	deleteConversation(id: string): Promise<void>
	addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<MessageRecord>
	getMessages(conversationId: string): Promise<MessageRecord[]>
	touchConversation(id: string): Promise<void>
	updateDraft(id: string, draft: string): Promise<void>
}
