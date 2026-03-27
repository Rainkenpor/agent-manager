const BASE = '/api'

function getHeaders(extra: Record<string, string> = {}): Record<string, string> {
	const token = localStorage.getItem('token')
	return {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...extra
	}
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
	const res = await fetch(`${BASE}${path}`, {
		...options,
		headers: getHeaders(options.headers as Record<string, string>)
	})
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: res.statusText }))
		throw new Error(err.error || res.statusText)
	}
	const text = await res.text()
	return (text ? JSON.parse(text) : undefined) as T
}

// Auth
export const login = (data: { username: string; password: string }) =>
	request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify(data) })

export const getMe = () => request<any>('/auth/me')

// Users
export const getUsers = () => request<any[]>('/users')
export const getUserById = (id: string) => request<any>(`/users/${id}`)
export const createUser = (data: any) => request<any>('/users/register', { method: 'POST', body: JSON.stringify(data) })
export const updateUser = (id: string, data: any) => request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteUser = (id: string) => request<any>(`/users/${id}`, { method: 'DELETE' })
export const assignRole = (userId: string, roleId: string) => request<any>(`/users/${userId}/roles/${roleId}`, { method: 'POST' })
export const removeRole = (userId: string, roleId: string) => request<any>(`/users/${userId}/roles/${roleId}`, { method: 'DELETE' })

// Roles
export const getRoles = () => request<any[]>('/roles')
export const getRoleById = (id: string) => request<any>(`/roles/${id}`)
export const createRole = (data: any) => request<any>('/roles', { method: 'POST', body: JSON.stringify(data) })
export const updateRole = (id: string, data: any) => request<any>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteRole = (id: string) => request<any>(`/roles/${id}`, { method: 'DELETE' })
export const assignPermission = (roleId: string, permissionId: string) =>
	request<any>(`/roles/${roleId}/permissions/${permissionId}`, { method: 'POST' })
export const removePermission = (roleId: string, permissionId: string) =>
	request<any>(`/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' })

// MCP Servers
export const getMcpServers = () => request<{ success: boolean; data: any[] }>('/mcp-servers')
export const getMcpServerById = (id: string) => request<any>(`/mcp-servers/${id}`)
export const createMcpServer = (data: any) => request<any>('/mcp-servers', { method: 'POST', body: JSON.stringify(data) })
export const updateMcpServer = (id: string, data: any) => request<any>(`/mcp-servers/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteMcpServer = (id: string) => request<any>(`/mcp-servers/${id}`, { method: 'DELETE' })

// Role ↔ MCPs
export const getRoleMcps = (roleId: string) => request<{ success: boolean; data: any[] }>(`/roles/${roleId}/mcps`)
export const assignMcpToRole = (roleId: string, mcpServerId: string) =>
	request<any>(`/roles/${roleId}/mcps/${mcpServerId}`, { method: 'POST' })
export const removeMcpFromRole = (roleId: string, mcpServerId: string) =>
	request<any>(`/roles/${roleId}/mcps/${mcpServerId}`, { method: 'DELETE' })

// Role ↔ Agents
export const getRoleAgents = (roleId: string) => request<{ success: boolean; data: any[] }>(`/roles/${roleId}/agents`)
export const assignAgentToRole = (roleId: string, agentId: string) => request<any>(`/roles/${roleId}/agents/${agentId}`, { method: 'POST' })
export const removeAgentFromRole = (roleId: string, agentId: string) =>
	request<any>(`/roles/${roleId}/agents/${agentId}`, { method: 'DELETE' })

// Agents
export const getAgents = () => request<{ success: boolean; data: any[] }>('/agents')
export const getAgentById = (id: string) => request<any>(`/agents/${id}`)
export const getAgentTools = () => request<{ success: boolean; data: any[] }>('/agents/tools')
export const createAgent = (data: any) => request<any>('/agents', { method: 'POST', body: JSON.stringify(data) })
export const updateAgent = (id: string, data: any) => request<any>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteAgent = (id: string) => request<any>(`/agents/${id}`, { method: 'DELETE' })

// MCP Server tools discovery
export const getMcpServerTools = (mcpServerId: string) =>
	request<{ success: boolean; data: Array<{ toolName: string; description: string }> }>(`/mcp-servers/${mcpServerId}/tools`)

// MCP Server connection status & reconnect
export const getMcpServerStatus = (mcpServerId: string) =>
	request<{ success: boolean; data: { connected: boolean } }>(`/mcp-servers/${mcpServerId}/status`)
export const reconnectMcpServer = (mcpServerId: string) =>
	request<{ success: boolean; data: { connected: boolean } }>(`/mcp-servers/${mcpServerId}/reconnect`, { method: 'POST' })

// Role MCP tool selection
export const getRoleMcpTools = (roleId: string, mcpServerId: string) =>
	request<{ success: boolean; data: string[] }>(`/roles/${roleId}/mcps/${mcpServerId}/tools`)
export const setRoleMcpTools = (roleId: string, mcpServerId: string, tools: string[]) =>
	request<{ success: boolean }>(`/roles/${roleId}/mcps/${mcpServerId}/tools`, {
		method: 'PUT',
		body: JSON.stringify({ tools })
	})

// Permissions
export const getPermissions = () => request<any[]>('/permissions')
export const getRolePermissions = (roleId: string) => request<any[]>(`/roles/${roleId}/permissions`)

// OAuth clients
export const getOAuthClients = () => request<{ success: boolean; data: any[] }>('/oauth/clients')

// OAuth authorize (SPA-friendly: returns redirect URL)
export const oauthAuthorize = (data: {
	client_id: string
	redirect_uri: string
	state?: string
	scope?: string
	username?: string
	password?: string
	token?: string
	approved: boolean
}) =>
	request<{ redirect?: string; error?: string }>('/oauth/authorize', {
		method: 'POST',
		body: JSON.stringify(data)
	})

// Chat
export const getConversations = () => request<{ success: boolean; data: any[] }>('/chat/conversations')
export const getConversation = (id: string) => request<{ success: boolean; data: any }>(`/chat/conversations/${id}`)
export const createConversation = (data: { title: string; agentId: string }) =>
	request<{ success: boolean; data: any }>('/chat/conversations', { method: 'POST', body: JSON.stringify(data) })
export const deleteConversation = (id: string) => request<{ success: boolean }>(`/chat/conversations/${id}`, { method: 'DELETE' })
export const sendMessage = (conversationId: string, content: string) =>
	request<{ success: boolean; data: any }>(`/chat/conversations/${conversationId}/messages`, {
		method: 'POST',
		body: JSON.stringify({ content })
	})

// MCP User Credentials
export const getMcpCredentials = (mcpServerId?: string) =>
	request<{ success: boolean; data: any[] }>(mcpServerId ? `/mcp-credentials/${mcpServerId}` : '/mcp-credentials')
export const upsertMcpCredential = (mcpServerId: string, key: string, value: string) =>
	request<{ success: boolean; data: any }>('/mcp-credentials', {
		method: 'PUT',
		body: JSON.stringify({ mcpServerId, key, value })
	})
export const deleteMcpCredential = (mcpServerId: string, key: string) =>
	request<{ success: boolean }>(`/mcp-credentials/${mcpServerId}/${encodeURIComponent(key)}`, { method: 'DELETE' })

export function streamMessage(conversationId: string, content: string, signal?: AbortSignal): Promise<Response> {
	const token = localStorage.getItem('token')
	return fetch(`${BASE}/chat/conversations/${conversationId}/messages`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		body: JSON.stringify({ content }),
		signal,
	})
}
