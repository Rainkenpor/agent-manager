export interface GovernanceSuggestionRecord {
	id: string
	type: string
	title: string
	content: string
	reason: string | null
	agentSlug: string | null
	userId: string | null
	userEmail: string | null
	createdAt: string
}

export interface CreateGovernanceSuggestionDTO {
	type: string
	title: string
	content: string
	reason?: string | null
	agentSlug?: string | null
	userId?: string | null
	userEmail?: string | null
}
