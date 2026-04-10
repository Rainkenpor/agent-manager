export interface User {
	id: string
	email: string
	username: string
	firstName?: string
	lastName?: string
	active: boolean
	createdAt: string
	updatedAt: string
	lastLoginAt?: string
	roles?: Role[]
	permissions?: Permission[]
}

export interface Role {
	id: string
	name: string
	description?: string
	active: boolean
	createdAt: string
	updatedAt: string
	permissions?: Permission[]
}

export interface Permission {
	id: string
	resource: string
	action: string
	description?: string
	createdAt: string
}

export interface Agent {
	id: string
	name: string
	slug: string
	description?: string
	mode: 'primary' | 'subagent'
	model: string
	temperature: string
	tools: Record<string, boolean>
	content: string
	createdAt: string
	updatedAt: string
	isActive: boolean
	subagents?: Agent[]
}

export interface AgentTool {
	name: string
	description?: string
	source: 'builtin' | 'registry' | 'external'
}

export interface CredentialField {
	key: string
	description: string
}

export interface McpServer {
	id: string
	name: string
	displayName?: string | null
	description?: string | null
	type: 'http' | 'stdio'
	url?: string | null
	command?: string | null
	args?: string[] | null
	headers?: Record<string, string> | null
	credentialFields?: CredentialField[] | null
	active: boolean
	createdAt: string
	updatedAt: string
}

export interface McpTool {
	toolName: string
	description: string
}

export interface OAuthClient {
	client_id: string
	client_name: string
	redirect_uris: string[]
	grant_types: string[]
	scope?: string
	createdAt: string
}
