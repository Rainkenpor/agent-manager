export interface PresetQnaRecord {
	id: string
	canonicalQuestion: string
	questions: string[]
	answer: string
	agentSlug: string
	isActive: boolean
	createdAt: string
	updatedAt: string
}

export interface CreatePresetQnaDTO {
	canonicalQuestion: string
	questions: string[]
	answer: string
	agentSlug: string
}

export interface UpdatePresetQnaDTO {
	id: string
	canonicalQuestion?: string
	questions?: string[]
	answer?: string
	isActive?: boolean
}
