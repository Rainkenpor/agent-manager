const BASE = '/api'

function getHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: getHeaders(options.headers as Record<string, string>),
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
export const assignPermission = (roleId: string, permissionId: string) => request<any>(`/roles/${roleId}/permissions/${permissionId}`, { method: 'POST' })
export const removePermission = (roleId: string, permissionId: string) => request<any>(`/roles/${roleId}/permissions/${permissionId}`, { method: 'DELETE' })

// Agents
export const getAgents = () => request<{ success: boolean; data: any[] }>('/agents')
export const getAgentById = (id: string) => request<any>(`/agents/${id}`)
export const getAgentTools = () => request<{ success: boolean; data: any[] }>('/agents/tools')
export const createAgent = (data: any) => request<any>('/agents', { method: 'POST', body: JSON.stringify(data) })
export const updateAgent = (id: string, data: any) => request<any>(`/agents/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteAgent = (id: string) => request<any>(`/agents/${id}`, { method: 'DELETE' })
