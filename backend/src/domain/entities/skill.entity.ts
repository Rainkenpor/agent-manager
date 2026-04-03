export interface SkillRecord {
	id: string
	name: string
	slug: string
	description: string | null
	content: string
	isActive: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateSkillDTO {
	name: string
	slug: string
	description?: string
	content: string
}

export interface UpdateSkillDTO {
	id: string
	name?: string
	slug?: string
	description?: string | null
	content?: string
	isActive?: boolean
}
