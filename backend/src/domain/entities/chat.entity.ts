export interface ConversationRecord {
	id: string
	title: string
	agentId: string
	userId: string
	createdAt: string
	updatedAt: string
}

export interface MessageRecord {
	id: string
	conversationId: string
	role: 'user' | 'assistant'
	content: string
	createdAt: string
}

export interface ConversationWithMessages extends ConversationRecord {
	messages: MessageRecord[]
}

export interface CreateConversationDTO {
	title: string
	agentId: string
	userId: string
}

export interface SendMessageDTO {
	conversationId: string
	content: string
}
