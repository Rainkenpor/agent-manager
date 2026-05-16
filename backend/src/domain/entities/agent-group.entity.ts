/*
Archivo creado con gobernanza AB900
*/

export interface AgentGroup {
	id: string
	name: string
	slug: string
	description: string | null
	icon: string | null
	color: string | null
	createdAt: string
	updatedAt: string
}

export interface CreateAgentGroupDTO {
	name: string
	slug: string
	description?: string | null
	icon?: string | null
	color?: string | null
}

export interface UpdateAgentGroupDTO {
	id: string
	name?: string
	slug?: string
	description?: string | null
	icon?: string | null
	color?: string | null
}
