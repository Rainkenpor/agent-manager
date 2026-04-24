import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { envs } from '../../envs.js'
import {
	UserEntity,
	RoleEntity,
	PermissionEntity,
	UserRoleEntity,
	RolePermissionEntity,
	AgentEntity,
	AgentSubagentEntity,
	McpServerEntity,
	RoleMcpEntity,
	RoleAgentEntity,
	RoleMcpToolEntity,
	OAuthClientEntity,
	OAuthCodeEntity,
	OAuthRefreshTokenEntity,
	ConversationEntity,
	MessageEntity,
	McpUserCredentialEntity,
	SkillEntity,
	RoleSkillEntity,
	TraceabilityTemplateEntity,
	TemplateStageEntity,
	TemplateStagePredecessorEntity,
	TraceabilityEntity,
	TraceabilityStageEntity,
	TraceabilityStagePredecessorEntity,
	TraceabilityTaskEntity,
	TraceabilityLinkEntity,
	TraceabilityDocumentEntity,
	HookServerEntity,
	HookAssignmentEntity,
	EventListenerEntity
} from './entities.js'

const entities = [
	UserEntity,
	RoleEntity,
	PermissionEntity,
	UserRoleEntity,
	RolePermissionEntity,
	AgentEntity,
	AgentSubagentEntity,
	McpServerEntity,
	RoleMcpEntity,
	RoleAgentEntity,
	RoleMcpToolEntity,
	OAuthClientEntity,
	OAuthCodeEntity,
	OAuthRefreshTokenEntity,
	ConversationEntity,
	MessageEntity,
	McpUserCredentialEntity,
	SkillEntity,
	RoleSkillEntity,
	TraceabilityTemplateEntity,
	TemplateStageEntity,
	TemplateStagePredecessorEntity,
	TraceabilityEntity,
	TraceabilityStageEntity,
	TraceabilityStagePredecessorEntity,
	TraceabilityTaskEntity,
	TraceabilityLinkEntity,
	TraceabilityDocumentEntity,
	HookServerEntity,
	HookAssignmentEntity,
	EventListenerEntity
]

let AppDataSource: DataSource

if (envs.SERVER_DB_DIALECT === 'sqlite') {
	const dbDir = dirname(envs.SERVER_DB_PATH)
	if (!existsSync(dbDir)) {
		mkdirSync(dbDir, { recursive: true })
	}

	AppDataSource = new DataSource({
		type: 'better-sqlite3',
		database: envs.SERVER_DB_PATH,
		synchronize: true,
		logging: false,
		entities,
		prepareDatabase: (db) => {
			db.pragma('journal_mode = WAL')
			db.pragma('foreign_keys = ON')
		}
	})
} else {
	AppDataSource = new DataSource({
		type: 'postgres',
		url: envs.SERVER_DB_URL,
		synchronize: true,
		logging: false,
		entities
	})
}

export { AppDataSource }
