import 'reflect-metadata'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DataSource } from 'typeorm'
import { envs } from '../../envs.js'
import {
	AgentEntity,
	AgentGroupAssignmentEntity,
	AgentGroupEntity,
	AgentSubagentEntity,
	ConversationEntity,
	EventListenerEntity,
	GovernanceEntity,
	GovernanceSuggestionEntity,
	HistoriaComentarioEntity,
	HistoriaUsuarioEntity,
	HookAssignmentEntity,
	HookServerEntity,
	IntegrationEntity,
	McpServerEntity,
	McpUserCredentialEntity,
	MessageEntity,
	OAuthClientEntity,
	OAuthCodeEntity,
	OAuthRefreshTokenEntity,
	PermissionEntity,
	PresetQnaEntity,
	ProviderConfigEntity,
	ProyectoEntity,
	ProyectoParticipanteEntity,
	ProyectoServicioEntity,
	RoleAgentEntity,
	RoleEntity,
	RoleMcpEntity,
	RoleMcpToolEntity,
	RolePermissionEntity,
	RoleSkillEntity,
	SkillEntity,
	TemplateStageEntity,
	TemplateStagePredecessorEntity,
	TokenAuditEntity,
	TraceabilityDocumentEntity,
	TraceabilityEntity,
	TraceabilityLinkEntity,
	TraceabilityParticipantEntity,
	TraceabilityParticipantStageChatEntity,
	TraceabilityStageEntity,
	TraceabilityStagePredecessorEntity,
	TraceabilityTaskEntity,
	TraceabilityTemplateEntity,
	UserEntity,
	UserRoleEntity,
	WebhookEntity,
	WebhookGroupEntity
} from './entities.js'

const entities = [
	UserEntity,
	RoleEntity,
	PermissionEntity,
	UserRoleEntity,
	RolePermissionEntity,
	AgentEntity,
	AgentGroupEntity,
	AgentGroupAssignmentEntity,
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
	ProviderConfigEntity,
	SkillEntity,
	RoleSkillEntity,
	GovernanceEntity,
	GovernanceSuggestionEntity,
	ProyectoEntity,
	ProyectoServicioEntity,
	HistoriaUsuarioEntity,
	HistoriaComentarioEntity,
	ProyectoParticipanteEntity,
	TraceabilityTemplateEntity,
	TemplateStageEntity,
	TemplateStagePredecessorEntity,
	TraceabilityEntity,
	TraceabilityParticipantEntity,
	TraceabilityParticipantStageChatEntity,
	TraceabilityStageEntity,
	TraceabilityStagePredecessorEntity,
	TraceabilityTaskEntity,
	TraceabilityLinkEntity,
	TraceabilityDocumentEntity,
	HookServerEntity,
	HookAssignmentEntity,
	EventListenerEntity,
	TokenAuditEntity,
	WebhookGroupEntity,
	WebhookEntity,
	PresetQnaEntity,
	IntegrationEntity
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
