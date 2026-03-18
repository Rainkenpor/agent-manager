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
  isActive: boolean
  createdAt: string
  updatedAt: string
  subagents?: Agent[]
}

export interface AgentTool {
  name: string
  description?: string
  source: 'builtin' | 'registry' | 'external'
}
