export interface GovernanceSection {
	title: string
	content: string
}

export interface GovernanceRecord {
	id: string
	name: string
	type: string
	description: string | null
	content: string
	sections: GovernanceSection[]
	isActive: boolean
	createdAt: string
	updatedAt: string
}

export interface CreateGovernanceDTO {
	name: string
	type: string
	description?: string
	content: string
	sections?: GovernanceSection[]
}

export interface UpdateGovernanceDTO {
	id: string
	name?: string
	type?: string
	description?: string | null
	content?: string
	sections?: GovernanceSection[]
	isActive?: boolean
}
