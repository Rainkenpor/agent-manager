export interface ConversationRecord {
	id: string
	title: string
	agentId: string
	userId: string
	draft: string | null
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

/** Miniatura de imagen (generada por una tool MCP) persistida junto a un mensaje. */
export interface PersistedImage {
	serverId?: string
	toolName: string
	args: Record<string, unknown>
	mimeType: string
	thumb: string
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
