import 'reflect-metadata'
import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('users')
export class UserEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text', unique: true })
	email!: string

	@Column({ type: 'text', unique: true })
	username!: string

	@Column({ type: 'text' })
	password!: string

	@Column({ name: 'first_name', type: 'text', nullable: true })
	firstName!: string | null

	@Column({ name: 'last_name', type: 'text', nullable: true })
	lastName!: string | null

	@Column({ type: 'boolean', default: true })
	active!: boolean

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string

	@Column({ name: 'last_login_at', type: 'text', nullable: true })
	lastLoginAt!: string | null
}

@Entity('roles')
export class RoleEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text', unique: true })
	name!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'boolean', default: true })
	active!: boolean

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('permissions')
export class PermissionEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text' })
	resource!: string

	@Column({ type: 'text' })
	action!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('user_roles')
export class UserRoleEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'user_id', type: 'text' })
	userId!: string

	@Column({ name: 'role_id', type: 'text' })
	roleId!: string

	@Column({ name: 'assigned_at', type: 'text' })
	assignedAt!: string
}

@Entity('role_permissions')
export class RolePermissionEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'role_id', type: 'text' })
	roleId!: string

	@Column({ name: 'permission_id', type: 'text' })
	permissionId!: string

	@Column({ name: 'assigned_at', type: 'text' })
	assignedAt!: string
}

@Entity('agents')
export class AgentEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text', unique: true })
	slug!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'text', default: 'subagent' })
	mode!: string

	@Column({ type: 'text', default: '<<AGENT_MODEL>>' })
	model!: string

	@Column({ type: 'text', default: '0.2' })
	temperature!: string

	@Column({ type: 'simple-json', default: '{}' })
	tools!: Record<string, boolean>

	@Column({ type: 'text', default: '' })
	content!: string

	@Column({ name: 'is_active', type: 'boolean', default: true })
	isActive!: boolean

	@Column({ name: 'use_by_chat', type: 'boolean', default: false })
	useByChat!: boolean

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('agent_subagents')
export class AgentSubagentEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'agent_id', type: 'text' })
	agentId!: string

	@Column({ name: 'subagent_id', type: 'text' })
	subagentId!: string

	@Column({ type: 'integer', default: 0 })
	order!: number

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('mcp_servers')
export class McpServerEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text', unique: true })
	name!: string

	@Column({ name: 'display_name', type: 'text', nullable: true })
	displayName!: string | null

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'text', default: 'http' })
	type!: string

	@Column({ type: 'text', nullable: true })
	url!: string | null

	@Column({ type: 'text', nullable: true })
	command!: string | null

	@Column({ type: 'simple-json', nullable: true })
	args!: string[] | null

	@Column({ type: 'simple-json', nullable: true })
	headers!: Record<string, string> | null

	@Column({ name: 'credential_fields', type: 'simple-json', nullable: true })
	credentialFields!: Array<{ key: string; description: string }> | null

	@Column({ type: 'boolean', default: true })
	active!: boolean

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('role_mcps')
export class RoleMcpEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'role_id', type: 'text' })
	roleId!: string

	@Column({ name: 'mcp_server_id', type: 'text' })
	mcpServerId!: string

	@Column({ name: 'assigned_at', type: 'text' })
	assignedAt!: string
}

@Entity('role_agents')
export class RoleAgentEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'role_id', type: 'text' })
	roleId!: string

	@Column({ name: 'agent_id', type: 'text' })
	agentId!: string

	@Column({ name: 'assigned_at', type: 'text' })
	assignedAt!: string
}

@Entity('role_mcp_tools')
export class RoleMcpToolEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'role_id', type: 'text' })
	roleId!: string

	@Column({ name: 'mcp_server_id', type: 'text' })
	mcpServerId!: string

	@Column({ name: 'tool_name', type: 'text' })
	toolName!: string

	@Column({ name: 'assigned_at', type: 'text' })
	assignedAt!: string
}

@Entity('oauth_clients')
export class OAuthClientEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text', nullable: true })
	secret!: string | null

	@Column({ type: 'text' })
	name!: string

	@Column({ name: 'redirect_uris', type: 'simple-json' })
	redirectUris!: string[]

	@Column({ name: 'grant_types', type: 'simple-json' })
	grantTypes!: string[]

	@Column({ type: 'text', nullable: true })
	scope!: string | null

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('oauth_codes')
export class OAuthCodeEntity {
	@PrimaryColumn({ type: 'text', name: 'code' })
	code!: string

	@Column({ name: 'client_id', type: 'text' })
	clientId!: string

	@Column({ name: 'user_id', type: 'text' })
	userId!: string

	@Column({ name: 'redirect_uri', type: 'text' })
	redirectUri!: string

	@Column({ type: 'text', nullable: true })
	scope!: string | null

	@Column({ name: 'code_challenge', type: 'text', nullable: true })
	codeChallenge!: string | null

	@Column({ name: 'code_challenge_method', type: 'text', nullable: true })
	codeChallengeMethod!: string | null

	@Column({ name: 'expires_at', type: 'text' })
	expiresAt!: string

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('oauth_refresh_tokens')
export class OAuthRefreshTokenEntity {
	@PrimaryColumn({ type: 'text', name: 'token' })
	token!: string

	@Column({ name: 'client_id', type: 'text' })
	clientId!: string

	@Column({ name: 'user_id', type: 'text' })
	userId!: string

	@Column({ type: 'text', nullable: true })
	scope!: string | null

	@Column({ name: 'expires_at', type: 'text' })
	expiresAt!: string

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('conversations')
export class ConversationEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text' })
	title!: string

	@Column({ name: 'agent_id', type: 'text' })
	agentId!: string

	@Column({ name: 'user_id', type: 'text' })
	userId!: string

	@Column({ type: 'text', nullable: true })
	draft!: string | null

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('messages')
export class MessageEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'conversation_id', type: 'text' })
	conversationId!: string

	@Column({ type: 'text' })
	role!: string

	@Column({ type: 'text' })
	content!: string

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('mcp_user_credentials')
export class McpUserCredentialEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'user_id', type: 'text' })
	userId!: string

	@Column({ name: 'mcp_server_id', type: 'text' })
	mcpServerId!: string

	@Column({ type: 'text' })
	key!: string

	@Column({ type: 'text' })
	value!: string

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('skills')
export class SkillEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text', unique: true })
	name!: string

	@Column({ type: 'text', unique: true })
	slug!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'text', default: '' })
	content!: string

	@Column({ name: 'is_active', type: 'boolean', default: true })
	isActive!: boolean

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('role_skills')
export class RoleSkillEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'role_id', type: 'text' })
	roleId!: string

	@Column({ name: 'skill_id', type: 'text' })
	skillId!: string

	@Column({ name: 'assigned_at', type: 'text' })
	assignedAt!: string
}

@Entity('traceability_templates')
export class TraceabilityTemplateEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text', unique: true, nullable: true })
	code!: string | null

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('template_stages')
export class TemplateStageEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'template_id', type: 'text' })
	templateId!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'text', nullable: true })
	role!: string | null

	@Column({ type: 'integer', default: 0 })
	order!: number

	@Column({ name: 'parallel_group', type: 'text', nullable: true })
	parallelGroup!: string | null

	@Column({ type: 'text', default: 'manual' })
	type!: string

	@Column({ name: 'agent_id', type: 'text', nullable: true })
	agentId!: string | null

	@Column({ name: 'document_schema', type: 'text', nullable: true })
	documentSchema!: string | null

	@Column({ name: 'effort_score', type: 'integer', default: 5 })
	effortScore!: number

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('template_stage_predecessors')
export class TemplateStagePredecessorEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'stage_id', type: 'text' })
	stageId!: string

	@Column({ name: 'predecessor_stage_id', type: 'text' })
	predecessorStageId!: string
}

@Entity('traceabilities')
export class TraceabilityEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text' })
	title!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'text', default: 'active' })
	status!: string

	@Column({ name: 'template_id', type: 'text', nullable: true })
	templateId!: string | null

	@Column({ name: 'template_name', type: 'text', nullable: true })
	templateName!: string | null

	@Column({ name: 'created_by', type: 'text', nullable: true })
	createdBy!: string | null

	@Column({ name: 'chat_id', type: 'text', nullable: true })
	chatId!: string | null

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('traceability_stages')
export class TraceabilityStageEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'traceability_id', type: 'text' })
	traceabilityId!: string

	@Column({ name: 'template_stage_id', type: 'text', nullable: true })
	templateStageId!: string | null

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'text', nullable: true })
	role!: string | null

	@Column({ type: 'integer', default: 0 })
	order!: number

	@Column({ name: 'parallel_group', type: 'text', nullable: true })
	parallelGroup!: string | null

	@Column({ type: 'text', default: 'manual' })
	type!: string

	@Column({ name: 'agent_id', type: 'text', nullable: true })
	agentId!: string | null

	@Column({ type: 'text', default: 'pending' })
	status!: string

	@Column({ name: 'effort_score', type: 'integer', default: 5 })
	effortScore!: number

	@Column({ name: 'assigned_user_id', type: 'text', nullable: true })
	assignedUserId!: string | null

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('traceability_stage_predecessors')
export class TraceabilityStagePredecessorEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'stage_id', type: 'text' })
	stageId!: string

	@Column({ name: 'predecessor_stage_id', type: 'text' })
	predecessorStageId!: string
}

@Entity('traceability_tasks')
export class TraceabilityTaskEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'stage_id', type: 'text' })
	stageId!: string

	@Column({ type: 'text' })
	title!: string

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'text', default: 'task' })
	type!: string

	@Column({ type: 'text', default: 'todo' })
	status!: string

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('traceability_links')
export class TraceabilityLinkEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'stage_id', type: 'text' })
	stageId!: string

	@Column({ type: 'text' })
	label!: string

	@Column({ type: 'text' })
	url!: string

	@Column({ type: 'text', default: 'generic' })
	platform!: string

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('traceability_documents')
export class TraceabilityDocumentEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'stage_id', type: 'text' })
	stageId!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text', default: '' })
	content!: string

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('hook_servers')
export class HookServerEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text', unique: true })
	name!: string

	@Column({ name: 'display_name', type: 'text', nullable: true })
	displayName!: string | null

	@Column({ type: 'text', nullable: true })
	description!: string | null

	@Column({ type: 'text' })
	url!: string

	@Column({ type: 'boolean', default: true })
	active!: boolean

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}

@Entity('hook_assignments')
export class HookAssignmentEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ name: 'hook_server_id', type: 'text' })
	hookServerId!: string

	@Column({ name: 'hook_name', type: 'text' })
	hookName!: string

	@Column({ name: 'assignment_type', type: 'text' })
	assignmentType!: string

	@Column({ name: 'assignment_id', type: 'text' })
	assignmentId!: string

	@Column({ name: 'assignment_name', type: 'text' })
	assignmentName!: string

	@Column({ name: 'extra_data', type: 'simple-json', nullable: true })
	extraData!: Record<string, string> | null

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string
}

@Entity('event_listeners')
export class EventListenerEntity {
	@PrimaryColumn({ type: 'text' })
	id!: string

	@Column({ type: 'text' })
	name!: string

	@Column({ type: 'text' })
	schedule!: string

	@Column({ type: 'simple-json' })
	source!: { function_name: string; params: Record<string, unknown> }

	@Column({ type: 'simple-json' })
	condition!: { field: string; operator: string; value: unknown }

	@Column({ type: 'simple-json' })
	action!: Array<{ function_name: string; params: Record<string, unknown> }>

	@Column({ type: 'boolean', default: true })
	enabled!: boolean

	@Column({ name: 'last_run_at', type: 'text', nullable: true })
	lastRunAt!: string | null

	@Column({ name: 'last_run_result', type: 'text', nullable: true })
	lastRunResult!: string | null

	@Column({ name: 'created_at', type: 'text' })
	createdAt!: string

	@Column({ name: 'updated_at', type: 'text' })
	updatedAt!: string
}
