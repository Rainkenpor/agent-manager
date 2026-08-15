import type {
	ConversationRecord,
	ConversationWithMessages,
	CreateConversationDTO,
	MessageRecord,
	PersistedImage
} from '../entities/chat.entity.js'

export interface IChatRepository {
	createConversation(data: CreateConversationDTO): Promise<ConversationRecord>
	findConversationsByUser(userId: string): Promise<ConversationRecord[]>
	findConversationById(id: string): Promise<ConversationWithMessages | null>
	deleteConversation(id: string): Promise<void>
	addMessage(conversationId: string, role: 'user' | 'assistant', content: string): Promise<MessageRecord>
	findMessageById(id: string): Promise<MessageRecord | null>
	appendMessageImages(id: string, images: PersistedImage[]): Promise<void>
	getMessages(conversationId: string): Promise<MessageRecord[]>
	touchConversation(id: string): Promise<void>
	updateTitle(id: string, title: string): Promise<void>
	updateDraft(id: string, draft: string): Promise<void>
	deleteMessagesFrom(conversationId: string, fromMessageId: string): Promise<void>
}
