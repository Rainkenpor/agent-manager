import { sqliteTable, text, integer, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

// Tabla de Usuarios
export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	email: text('email').notNull().unique(),
	username: text('username').notNull().unique(),
	password: text('password').notNull(), // Hash bcrypt
	firstName: text('first_name'),
	lastName: text('last_name'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	lastLoginAt: text('last_login_at')
})

// Tabla de Roles
export const roles = sqliteTable('roles', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Tabla de Permisos
export const permissions = sqliteTable('permissions', {
	id: text('id').primaryKey(),
	resource: text('resource').notNull(), // Ej: "projects", "sections", "users"
	action: text('action').notNull(), // Ej: "create", "read", "update", "delete"
	description: text('description'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Relación muchos a muchos: Usuarios - Roles
export const userRoles = sqliteTable('user_roles', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	roleId: text('role_id')
		.notNull()
		.references(() => roles.id, { onDelete: 'cascade' }),
	assignedAt: text('assigned_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Relación muchos a muchos: Roles - Permisos
export const rolePermissions = sqliteTable('role_permissions', {
	id: text('id').primaryKey(),
	roleId: text('role_id')
		.notNull()
		.references(() => roles.id, { onDelete: 'cascade' }),
	permissionId: text('permission_id')
		.notNull()
		.references(() => permissions.id, { onDelete: 'cascade' }),
	assignedAt: text('assigned_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Tabla de Agentes (Markdown agents para IA)
export const agents = sqliteTable('agents', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	slug: text('slug').notNull().unique(), // nombre del archivo .md
	description: text('description'),
	mode: text('mode', { enum: ['primary', 'subagent'] })
		.notNull()
		.default('subagent'),
	model: text('model').notNull().default('<<AGENT_MODEL>>'),
	temperature: text('temperature').notNull().default('0.2'), // almacenado como string para evitar precision issues
	tools: text('tools', { mode: 'json' })
		.notNull()
		.$default(() => ({})), // Record<string, boolean>
	content: text('content').notNull().default(''), // Cuerpo markdown sin frontmatter
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	useByChat: integer('use_by_chat', { mode: 'boolean' }).notNull().default(false),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Tabla de relación Agente → Subagentes (muchos-a-muchos self-referencial)
export const agentSubagents = sqliteTable('agent_subagents', {
	id: text('id').primaryKey(),
	agentId: text('agent_id')
		.notNull()
		.references(() => agents.id, { onDelete: 'cascade' }),
	subagentId: text('subagent_id')
		.notNull()
		.references(() => agents.id, { onDelete: 'cascade' }),
	order: integer('order').notNull().default(0),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// MCP Servers table — defines available external MCP servers
export const mcpServers = sqliteTable('mcp_servers', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(), // identifier, e.g. "atlassian"
	displayName: text('display_name'), // human-readable name
	description: text('description'),
	type: text('type', { enum: ['http', 'stdio'] })
		.notNull()
		.default('http'),
	url: text('url'), // for type="http"
	command: text('command'), // for type="stdio"
	args: text('args', { mode: 'json' }).$type<string[]>(), // for type="stdio"
	headers: text('headers', { mode: 'json' }).$type<Record<string, string>>(),
	credentialFields: text('credential_fields', { mode: 'json' }).$type<Array<{ key: string; description: string }>>(),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Role ↔ MCP Servers (many-to-many)
export const roleMcps = sqliteTable('role_mcps', {
	id: text('id').primaryKey(),
	roleId: text('role_id')
		.notNull()
		.references(() => roles.id, { onDelete: 'cascade' }),
	mcpServerId: text('mcp_server_id')
		.notNull()
		.references(() => mcpServers.id, { onDelete: 'cascade' }),
	assignedAt: text('assigned_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Role ↔ Agents (many-to-many)
export const roleAgents = sqliteTable('role_agents', {
	id: text('id').primaryKey(),
	roleId: text('role_id')
		.notNull()
		.references(() => roles.id, { onDelete: 'cascade' }),
	agentId: text('agent_id')
		.notNull()
		.references(() => agents.id, { onDelete: 'cascade' }),
	assignedAt: text('assigned_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Role ↔ MCP Tools (granular tool selection per role+server)
export const roleMcpTools = sqliteTable('role_mcp_tools', {
	id: text('id').primaryKey(),
	roleId: text('role_id')
		.notNull()
		.references(() => roles.id, { onDelete: 'cascade' }),
	mcpServerId: text('mcp_server_id')
		.notNull()
		.references(() => mcpServers.id, { onDelete: 'cascade' }),
	toolName: text('tool_name').notNull(), // e.g. "create_issue", "search_issues"
	assignedAt: text('assigned_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// OAuth Clients (persistent client registry)
export const oauthClients = sqliteTable('oauth_clients', {
	id: text('id').primaryKey(), // client_id
	secret: text('secret'), // client_secret (null = public client)
	name: text('name').notNull(), // client_name
	redirectUris: text('redirect_uris', { mode: 'json' }).$type<string[]>().notNull(),
	grantTypes: text('grant_types', { mode: 'json' }).$type<string[]>().notNull(),
	scope: text('scope'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// OAuth Authorization Codes (short-lived)
export const oauthCodes = sqliteTable('oauth_codes', {
	code: text('code').primaryKey(),
	clientId: text('client_id')
		.notNull()
		.references(() => oauthClients.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	redirectUri: text('redirect_uri').notNull(),
	scope: text('scope'),
	codeChallenge: text('code_challenge'),
	codeChallengeMethod: text('code_challenge_method'),
	expiresAt: text('expires_at').notNull(),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// OAuth Refresh Tokens
export const oauthRefreshTokens = sqliteTable('oauth_refresh_tokens', {
	token: text('token').primaryKey(),
	clientId: text('client_id')
		.notNull()
		.references(() => oauthClients.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	scope: text('scope'),
	expiresAt: text('expires_at').notNull(),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Conversations (chat sessions)
export const conversations = sqliteTable('conversations', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	agentId: text('agent_id')
		.notNull()
		.references(() => agents.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	draft: text('draft'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// MCP User Credentials — key-value store per user+mcp pair
export const mcpUserCredentials = sqliteTable('mcp_user_credentials', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	mcpServerId: text('mcp_server_id')
		.notNull()
		.references(() => mcpServers.id, { onDelete: 'cascade' }),
	key: text('key').notNull(),
	value: text('value').notNull(),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Messages within a conversation
export const messages = sqliteTable('messages', {
	id: text('id').primaryKey(),
	conversationId: text('conversation_id')
		.notNull()
		.references(() => conversations.id, { onDelete: 'cascade' }),
	role: text('role', { enum: ['user', 'assistant'] }).notNull(),
	content: text('content').notNull(),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Skills — reusable instruction blocks that can be referenced by agents
export const skills = sqliteTable('skills', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	slug: text('slug').notNull().unique(),
	description: text('description'),
	content: text('content').notNull().default(''),
	isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Role ↔ Skills (many-to-many) — restricts which skills each role can access
export const roleSkills = sqliteTable('role_skills', {
	id: text('id').primaryKey(),
	roleId: text('role_id')
		.notNull()
		.references(() => roles.id, { onDelete: 'cascade' }),
	skillId: text('skill_id')
		.notNull()
		.references(() => skills.id, { onDelete: 'cascade' }),
	assignedAt: text('assigned_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// ─── Traceability ─────────────────────────────────────────────────────────────

// Templates — define the stages and their order
export const traceabilityTemplates = sqliteTable('traceability_templates', {
	id: text('id').primaryKey(),
	code: text('code').unique(), // 4-char alphanumeric lookup code
	name: text('name').notNull(),
	description: text('description'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Template stages — each stage in a template with order and optional parallel group
export const templateStages = sqliteTable('template_stages', {
	id: text('id').primaryKey(),
	templateId: text('template_id')
		.notNull()
		.references(() => traceabilityTemplates.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	role: text('role'),
	order: integer('order').notNull().default(0),
	parallelGroup: text('parallel_group'), // stages sharing the same value run in parallel
	type: text('type', { enum: ['manual', 'agent'] })
		.notNull()
		.default('manual'),
	agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
	documentSchema: text('document_schema'), // JSON: [{name, required}]
	effortScore: integer('effort_score').notNull().default(5), // effort score 1-10 for this stage
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Traceability instances — created from a template
export const traceabilities = sqliteTable('traceabilities', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description'),
	status: text('status', { enum: ['active', 'completed', 'archived'] })
		.notNull()
		.default('active'),
	templateId: text('template_id').references(() => traceabilityTemplates.id, { onDelete: 'set null' }),
	templateName: text('template_name'), // snapshot of template name at creation time
	createdBy: text('created_by'), // user id who created the traceability (null if created by agent/tool)
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Traceability stage instances — created from template stages
export const traceabilityStages = sqliteTable('traceability_stages', {
	id: text('id').primaryKey(),
	traceabilityId: text('traceability_id')
		.notNull()
		.references(() => traceabilities.id, { onDelete: 'cascade' }),
	templateStageId: text('template_stage_id').references(() => templateStages.id, { onDelete: 'set null' }),
	name: text('name').notNull(),
	description: text('description'),
	role: text('role'),
	order: integer('order').notNull().default(0),
	parallelGroup: text('parallel_group'),
	type: text('type', { enum: ['manual', 'agent'] })
		.notNull()
		.default('manual'),
	agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
	status: text('status', { enum: ['pending', 'active', 'completed', 'blocked', 'in-review'] })
		.notNull()
		.default('pending'),
	effortScore: integer('effort_score').notNull().default(5), // effort score 1-10, copied from template stage
	assignedUserId: text('assigned_user_id').references(() => users.id, { onDelete: 'set null' }),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Tasks per stage
export const traceabilityTasks = sqliteTable('traceability_tasks', {
	id: text('id').primaryKey(),
	stageId: text('stage_id')
		.notNull()
		.references(() => traceabilityStages.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	type: text('type', { enum: ['task', 'bug'] })
		.notNull()
		.default('task'),
	status: text('status', { enum: ['todo', 'in-progress', 'done', 'blocked'] })
		.notNull()
		.default('todo'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Links per stage
export const traceabilityLinks = sqliteTable('traceability_links', {
	id: text('id').primaryKey(),
	stageId: text('stage_id')
		.notNull()
		.references(() => traceabilityStages.id, { onDelete: 'cascade' }),
	label: text('label').notNull(),
	url: text('url').notNull(),
	platform: text('platform', { enum: ['jira', 'confluence', 'github', 'gitlab', 'generic'] })
		.notNull()
		.default('generic'),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Predecessor junction tables for DAG-based stage ordering
export const templateStagePredecessors = sqliteTable('template_stage_predecessors', {
	id: text('id').primaryKey(),
	stageId: text('stage_id')
		.notNull()
		.references(() => templateStages.id, { onDelete: 'cascade' }),
	predecessorStageId: text('predecessor_stage_id')
		.notNull()
		.references(() => templateStages.id, { onDelete: 'cascade' })
})

export const traceabilityStagePredecessors = sqliteTable('traceability_stage_predecessors', {
	id: text('id').primaryKey(),
	stageId: text('stage_id')
		.notNull()
		.references(() => traceabilityStages.id, { onDelete: 'cascade' }),
	predecessorStageId: text('predecessor_stage_id')
		.notNull()
		.references(() => traceabilityStages.id, { onDelete: 'cascade' })
})

// Documents per stage — markdown documents attached to a traceability stage
export const traceabilityDocuments = sqliteTable('traceability_documents', {
	id: text('id').primaryKey(),
	stageId: text('stage_id')
		.notNull()
		.references(() => traceabilityStages.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	content: text('content').notNull().default(''),
	createdAt: text('created_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text('updated_at')
		.notNull()
		.$defaultFn(() => new Date().toISOString())
})

// Tipos inferidos
export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
export type RoleSkill = typeof roleSkills.$inferSelect
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Role = typeof roles.$inferSelect
export type NewRole = typeof roles.$inferInsert
export type Permission = typeof permissions.$inferSelect
export type NewPermission = typeof permissions.$inferInsert
export type UserRole = typeof userRoles.$inferSelect
export type NewUserRole = typeof userRoles.$inferInsert
export type RolePermission = typeof rolePermissions.$inferSelect
export type NewRolePermission = typeof rolePermissions.$inferInsert
export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type AgentSubagent = typeof agentSubagents.$inferSelect
export type NewAgentSubagent = typeof agentSubagents.$inferInsert
export type McpServer = typeof mcpServers.$inferSelect
export type NewMcpServer = typeof mcpServers.$inferInsert
export type RoleMcp = typeof roleMcps.$inferSelect
export type RoleAgent = typeof roleAgents.$inferSelect
export type RoleMcpTool = typeof roleMcpTools.$inferSelect
export type NewRoleMcpTool = typeof roleMcpTools.$inferInsert
export type OAuthClient = typeof oauthClients.$inferSelect
export type NewOAuthClient = typeof oauthClients.$inferInsert
export type OAuthCode = typeof oauthCodes.$inferSelect
export type OAuthRefreshToken = typeof oauthRefreshTokens.$inferSelect
export type McpUserCredential = typeof mcpUserCredentials.$inferSelect
export type NewMcpUserCredential = typeof mcpUserCredentials.$inferInsert
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert

export type TraceabilityTemplate = typeof traceabilityTemplates.$inferSelect
export type NewTraceabilityTemplate = typeof traceabilityTemplates.$inferInsert
export type TemplateStage = typeof templateStages.$inferSelect
export type NewTemplateStage = typeof templateStages.$inferInsert
export type Traceability = typeof traceabilities.$inferSelect
export type NewTraceability = typeof traceabilities.$inferInsert
export type TraceabilityStage = typeof traceabilityStages.$inferSelect
export type NewTraceabilityStage = typeof traceabilityStages.$inferInsert
export type TraceabilityTask = typeof traceabilityTasks.$inferSelect
export type NewTraceabilityTask = typeof traceabilityTasks.$inferInsert
export type TraceabilityLink = typeof traceabilityLinks.$inferSelect
export type NewTraceabilityLink = typeof traceabilityLinks.$inferInsert
export type TemplateStagePredecessor = typeof templateStagePredecessors.$inferSelect
export type TraceabilityStagePredecessor = typeof traceabilityStagePredecessors.$inferSelect
export type TraceabilityDocument = typeof traceabilityDocuments.$inferSelect
export type NewTraceabilityDocument = typeof traceabilityDocuments.$inferInsert
