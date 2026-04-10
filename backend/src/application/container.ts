import type {
	IUserRepository,
	IRoleRepository,
	IPermissionRepository,
	IAgentRepository,
	IMcpServerRepository,
	IChatRepository,
	IMcpUserCredentialRepository,
	IMcpCredentialProvider,
	ISkillRepository,
	ITraceabilityRepository
} from '@domain/repositories/index.js'
import { mcpExternalManager } from '@infra/service/mcp-external.js'

import {
	AgentRepository,
	UserRepository,
	RoleRepository,
	PermissionRepository,
	McpServerRepository,
	ChatRepository,
	McpUserCredentialRepository,
	SkillRepository,
	TraceabilityRepository
} from '@infra/repository/index.js'

import {
	// User
	CreateUserUseCase,
	LoginUseCase,
	CheckPermissionUseCase,
	AssignRoleUseCase,
	AssignPermissionUseCase,
	// Agent Use Cases
	CreateAgentUseCase,
	ListAgentsUseCase,
	GetAgentUseCase,
	UpdateAgentUseCase,
	DeleteAgentUseCase,
	DuplicateAgentUseCase,
	// Chat Use Cases
	CreateConversationUseCase,
	ListConversationsUseCase,
	GetConversationUseCase,
	DeleteConversationUseCase,
	StreamMessageUseCase,
	// MCP Credential Use Cases
	GetMcpCredentialsUseCase,
	UpsertMcpCredentialUseCase,
	DeleteMcpCredentialUseCase,
	// Skill Use Cases
	CreateSkillUseCase,
	ListSkillsUseCase,
	GetSkillUseCase,
	UpdateSkillUseCase,
	DeleteSkillUseCase,
	// Traceability Use Cases
	ListTemplatesUseCase,
	GetTemplateUseCase,
	CreateTemplateUseCase,
	UpdateTemplateUseCase,
	DeleteTemplateUseCase,
	CreateTemplateStageUseCase,
	UpdateTemplateStageUseCase,
	DeleteTemplateStageUseCase,
	ListTraceabilitiesUseCase,
	GetTraceabilityUseCase,
	CreateTraceabilityUseCase,
	UpdateTraceabilityUseCase,
	DeleteTraceabilityUseCase,
	CreateTaskUseCase,
	UpdateTaskUseCase,
	DeleteTaskUseCase,
	CreateLinkUseCase,
	DeleteLinkUseCase,
	CreateDocumentUseCase,
	UpdateDocumentUseCase,
	DeleteDocumentUseCase,
	GetDocumentUseCase,
	GetTemplateByCodeUseCase
} from './use-cases/index.js'
import { GetSkillsAllowedForUserUseCase } from './use-cases/skill/get-skills-allowed-user.js'
import { TraceabilityAgentTriggerService } from '@infra/service/traceability-agent-trigger.service.js'

/**
 * Adaptador que implementa IMcpCredentialProvider usando IMcpUserCredentialRepository.
 * Traduce McpUserCredential[] → Record<string, string> para el manager de infraestructura.
 */
class McpCredentialProviderAdapter implements IMcpCredentialProvider {
	constructor(private readonly repo: IMcpUserCredentialRepository) {}

	async getCredentials(userId: string, mcpServerId: string, showValue?: boolean): Promise<Record<string, string>> {
		const creds = await this.repo.findByUserAndMcp(userId, mcpServerId, showValue)
		return Object.fromEntries(creds.map((c) => [c.key, c.value]))
	}
}

/**
 * Dependency Injection Container
 * Implements a simple IoC container pattern for managing dependencies
 */
export class Container {
	// Repository instances
	private _userRepository: IUserRepository
	private _roleRepository: IRoleRepository
	private _permissionRepository: IPermissionRepository

	// Auth Use Cases
	private _createUserUseCase?: CreateUserUseCase
	private _loginUseCase?: LoginUseCase
	private _checkPermissionUseCase?: CheckPermissionUseCase
	private _assignRoleUseCase?: AssignRoleUseCase
	private _assignPermissionUseCase?: AssignPermissionUseCase

	// Agent Use Cases
	private _agentRepository: IAgentRepository
	private _createAgentUseCase?: CreateAgentUseCase
	private _listAgentsUseCase?: ListAgentsUseCase
	private _getAgentUseCase?: GetAgentUseCase
	private _updateAgentUseCase?: UpdateAgentUseCase
	private _deleteAgentUseCase?: DeleteAgentUseCase
	private _duplicateAgentUseCase?: DuplicateAgentUseCase

	// MCP Server Repository
	private _mcpServerRepository: IMcpServerRepository

	// Chat Repository
	private _chatRepository: IChatRepository

	// Chat Use Cases
	private _createConversationUseCase?: CreateConversationUseCase
	private _listConversationsUseCase?: ListConversationsUseCase
	private _getConversationUseCase?: GetConversationUseCase
	private _deleteConversationUseCase?: DeleteConversationUseCase
	private _streamMessageUseCase?: StreamMessageUseCase

	// MCP User Credential Repository & Use Cases
	private _mcpUserCredentialRepository: IMcpUserCredentialRepository
	private _getMcpCredentialsUseCase?: GetMcpCredentialsUseCase
	private _upsertMcpCredentialUseCase?: UpsertMcpCredentialUseCase
	private _deleteMcpCredentialUseCase?: DeleteMcpCredentialUseCase

	// Skill Repository & Use Cases
	private _skillRepository: ISkillRepository
	private _createSkillUseCase?: CreateSkillUseCase
	private _listSkillsUseCase?: ListSkillsUseCase
	private _getSkillsAllowedForUserUseCase?: GetSkillsAllowedForUserUseCase
	private _getSkillUseCase?: GetSkillUseCase
	private _updateSkillUseCase?: UpdateSkillUseCase
	private _deleteSkillUseCase?: DeleteSkillUseCase

	// Traceability Repository & Use Cases
	private _traceabilityRepository: ITraceabilityRepository
	private _tracTriggerService?: TraceabilityAgentTriggerService
	private _listTemplatesUseCase?: ListTemplatesUseCase
	private _getTemplateUseCase?: GetTemplateUseCase
	private _createTemplateUseCase?: CreateTemplateUseCase
	private _updateTemplateUseCase?: UpdateTemplateUseCase
	private _deleteTemplateUseCase?: DeleteTemplateUseCase
	private _createTemplateStageUseCase?: CreateTemplateStageUseCase
	private _updateTemplateStageUseCase?: UpdateTemplateStageUseCase
	private _deleteTemplateStageUseCase?: DeleteTemplateStageUseCase
	private _listTraceabilitiesUseCase?: ListTraceabilitiesUseCase
	private _getTraceabilityUseCase?: GetTraceabilityUseCase
	private _createTraceabilityUseCase?: CreateTraceabilityUseCase
	private _updateTraceabilityUseCase?: UpdateTraceabilityUseCase
	private _deleteTraceabilityUseCase?: DeleteTraceabilityUseCase
	private _createTaskUseCase?: CreateTaskUseCase
	private _updateTaskUseCase?: UpdateTaskUseCase
	private _deleteTaskUseCase?: DeleteTaskUseCase
	private _createLinkUseCase?: CreateLinkUseCase
	private _deleteLinkUseCase?: DeleteLinkUseCase
	private _createDocumentUseCase?: CreateDocumentUseCase
	private _updateDocumentUseCase?: UpdateDocumentUseCase
	private _deleteDocumentUseCase?: DeleteDocumentUseCase
	private _getDocumentUseCase?: GetDocumentUseCase
	private _getTemplateByCodeUseCase?: GetTemplateByCodeUseCase

	constructor() {
		// Initialize repositories with concrete implementations
		this._userRepository = new UserRepository()
		this._roleRepository = new RoleRepository()
		this._permissionRepository = new PermissionRepository()
		this._agentRepository = new AgentRepository()
		this._mcpServerRepository = new McpServerRepository()
		this._chatRepository = new ChatRepository()
		this._mcpUserCredentialRepository = new McpUserCredentialRepository()
		this._skillRepository = new SkillRepository()
		this._traceabilityRepository = new TraceabilityRepository()

		// Inyectar el adaptador de credenciales en McpExternalManager (dependency inversion)
		mcpExternalManager.setCredentialProvider(new McpCredentialProviderAdapter(this._mcpUserCredentialRepository))
	}

	// ==========================================
	// REPOSITORIES (for testing/mocking)
	// ==========================================

	get userRepository(): IUserRepository {
		return this._userRepository
	}

	get roleRepository(): IRoleRepository {
		return this._roleRepository
	}

	get permissionRepository(): IPermissionRepository {
		return this._permissionRepository
	}

	get mcpServerRepository(): IMcpServerRepository {
		return this._mcpServerRepository
	}

	get chatRepository(): IChatRepository {
		return this._chatRepository
	}

	// ==========================================
	// AUTH & USER USE CASES
	// ==========================================

	get createUserUseCase(): CreateUserUseCase {
		if (!this._createUserUseCase) {
			this._createUserUseCase = new CreateUserUseCase(this._userRepository)
		}
		return this._createUserUseCase
	}

	get loginUseCase(): LoginUseCase {
		if (!this._loginUseCase) {
			this._loginUseCase = new LoginUseCase(this._userRepository)
		}
		return this._loginUseCase
	}

	get checkPermissionUseCase(): CheckPermissionUseCase {
		if (!this._checkPermissionUseCase) {
			this._checkPermissionUseCase = new CheckPermissionUseCase(this._userRepository)
		}
		return this._checkPermissionUseCase
	}

	get assignRoleUseCase(): AssignRoleUseCase {
		if (!this._assignRoleUseCase) {
			this._assignRoleUseCase = new AssignRoleUseCase(this._userRepository, this._roleRepository)
		}
		return this._assignRoleUseCase
	}

	get assignPermissionUseCase(): AssignPermissionUseCase {
		if (!this._assignPermissionUseCase) {
			this._assignPermissionUseCase = new AssignPermissionUseCase(this._roleRepository, this._permissionRepository)
		}
		return this._assignPermissionUseCase
	}

	// ==========================================
	// AGENT USE CASES
	// ==========================================

	get createAgentUseCase(): CreateAgentUseCase {
		if (!this._createAgentUseCase) {
			this._createAgentUseCase = new CreateAgentUseCase(this._agentRepository)
		}
		return this._createAgentUseCase
	}

	get listAgentsUseCase(): ListAgentsUseCase {
		if (!this._listAgentsUseCase) {
			this._listAgentsUseCase = new ListAgentsUseCase(this._agentRepository)
		}
		return this._listAgentsUseCase
	}

	get getAgentUseCase(): GetAgentUseCase {
		if (!this._getAgentUseCase) {
			this._getAgentUseCase = new GetAgentUseCase(this._agentRepository)
		}
		return this._getAgentUseCase
	}

	get updateAgentUseCase(): UpdateAgentUseCase {
		if (!this._updateAgentUseCase) {
			this._updateAgentUseCase = new UpdateAgentUseCase(this._agentRepository)
		}
		return this._updateAgentUseCase
	}

	get deleteAgentUseCase(): DeleteAgentUseCase {
		if (!this._deleteAgentUseCase) {
			this._deleteAgentUseCase = new DeleteAgentUseCase(this._agentRepository)
		}
		return this._deleteAgentUseCase
	}

	get duplicateAgentUseCase(): DuplicateAgentUseCase {
		if (!this._duplicateAgentUseCase) {
			this._duplicateAgentUseCase = new DuplicateAgentUseCase(this._agentRepository)
		}
		return this._duplicateAgentUseCase
	}

	// ==========================================
	// CHAT USE CASES
	// ==========================================

	get createConversationUseCase(): CreateConversationUseCase {
		if (!this._createConversationUseCase) {
			this._createConversationUseCase = new CreateConversationUseCase(this._chatRepository)
		}
		return this._createConversationUseCase
	}

	get listConversationsUseCase(): ListConversationsUseCase {
		if (!this._listConversationsUseCase) {
			this._listConversationsUseCase = new ListConversationsUseCase(this._chatRepository)
		}
		return this._listConversationsUseCase
	}

	get getConversationUseCase(): GetConversationUseCase {
		if (!this._getConversationUseCase) {
			this._getConversationUseCase = new GetConversationUseCase(this._chatRepository)
		}
		return this._getConversationUseCase
	}

	get deleteConversationUseCase(): DeleteConversationUseCase {
		if (!this._deleteConversationUseCase) {
			this._deleteConversationUseCase = new DeleteConversationUseCase(this._chatRepository)
		}
		return this._deleteConversationUseCase
	}

	get streamMessageUseCase(): StreamMessageUseCase {
		if (!this._streamMessageUseCase) {
			this._streamMessageUseCase = new StreamMessageUseCase(
				this._chatRepository,
				this._agentRepository,
				this._mcpUserCredentialRepository,
				this.mcpServerRepository
			)
		}
		return this._streamMessageUseCase
	}

	// ==========================================
	// MCP CREDENTIAL USE CASES
	// ==========================================

	get mcpUserCredentialRepository(): IMcpUserCredentialRepository {
		return this._mcpUserCredentialRepository
	}

	get getMcpCredentialsUseCase(): GetMcpCredentialsUseCase {
		if (!this._getMcpCredentialsUseCase) {
			this._getMcpCredentialsUseCase = new GetMcpCredentialsUseCase(this._mcpUserCredentialRepository)
		}
		return this._getMcpCredentialsUseCase
	}

	get upsertMcpCredentialUseCase(): UpsertMcpCredentialUseCase {
		if (!this._upsertMcpCredentialUseCase) {
			this._upsertMcpCredentialUseCase = new UpsertMcpCredentialUseCase(this._mcpUserCredentialRepository)
		}
		return this._upsertMcpCredentialUseCase
	}

	get deleteMcpCredentialUseCase(): DeleteMcpCredentialUseCase {
		if (!this._deleteMcpCredentialUseCase) {
			this._deleteMcpCredentialUseCase = new DeleteMcpCredentialUseCase(this._mcpUserCredentialRepository)
		}
		return this._deleteMcpCredentialUseCase
	}

	// ==========================================
	// SKILL REPOSITORY (direct access)
	// ==========================================

	get skillRepository(): ISkillRepository {
		return this._skillRepository
	}

	// ==========================================
	// SKILL USE CASES
	// ==========================================

	get createSkillUseCase(): CreateSkillUseCase {
		if (!this._createSkillUseCase) {
			this._createSkillUseCase = new CreateSkillUseCase(this._skillRepository)
		}
		return this._createSkillUseCase
	}

	get listSkillsUseCase(): ListSkillsUseCase {
		if (!this._listSkillsUseCase) {
			this._listSkillsUseCase = new ListSkillsUseCase(this._skillRepository)
		}
		return this._listSkillsUseCase
	}

	get getSkillsAllowedForUserUseCase(): GetSkillsAllowedForUserUseCase {
		if (!this._getSkillsAllowedForUserUseCase) {
			this._getSkillsAllowedForUserUseCase = new GetSkillsAllowedForUserUseCase(this._skillRepository)
		}
		return this._getSkillsAllowedForUserUseCase
	}

	get getSkillUseCase(): GetSkillUseCase {
		if (!this._getSkillUseCase) {
			this._getSkillUseCase = new GetSkillUseCase(this._skillRepository)
		}
		return this._getSkillUseCase
	}

	get updateSkillUseCase(): UpdateSkillUseCase {
		if (!this._updateSkillUseCase) {
			this._updateSkillUseCase = new UpdateSkillUseCase(this._skillRepository)
		}
		return this._updateSkillUseCase
	}

	get deleteSkillUseCase(): DeleteSkillUseCase {
		if (!this._deleteSkillUseCase) {
			this._deleteSkillUseCase = new DeleteSkillUseCase(this._skillRepository)
		}
		return this._deleteSkillUseCase
	}

	// ==========================================
	// TRACEABILITY USE CASES
	// ==========================================

	get listTemplatesUseCase(): ListTemplatesUseCase {
		if (!this._listTemplatesUseCase) this._listTemplatesUseCase = new ListTemplatesUseCase(this._traceabilityRepository)
		return this._listTemplatesUseCase
	}

	get getTemplateUseCase(): GetTemplateUseCase {
		if (!this._getTemplateUseCase) this._getTemplateUseCase = new GetTemplateUseCase(this._traceabilityRepository)
		return this._getTemplateUseCase
	}

	get createTemplateUseCase(): CreateTemplateUseCase {
		if (!this._createTemplateUseCase) this._createTemplateUseCase = new CreateTemplateUseCase(this._traceabilityRepository)
		return this._createTemplateUseCase
	}

	get updateTemplateUseCase(): UpdateTemplateUseCase {
		if (!this._updateTemplateUseCase) this._updateTemplateUseCase = new UpdateTemplateUseCase(this._traceabilityRepository)
		return this._updateTemplateUseCase
	}

	get deleteTemplateUseCase(): DeleteTemplateUseCase {
		if (!this._deleteTemplateUseCase) this._deleteTemplateUseCase = new DeleteTemplateUseCase(this._traceabilityRepository)
		return this._deleteTemplateUseCase
	}

	get createTemplateStageUseCase(): CreateTemplateStageUseCase {
		if (!this._createTemplateStageUseCase) this._createTemplateStageUseCase = new CreateTemplateStageUseCase(this._traceabilityRepository)
		return this._createTemplateStageUseCase
	}

	get updateTemplateStageUseCase(): UpdateTemplateStageUseCase {
		if (!this._updateTemplateStageUseCase) this._updateTemplateStageUseCase = new UpdateTemplateStageUseCase(this._traceabilityRepository)
		return this._updateTemplateStageUseCase
	}

	get deleteTemplateStageUseCase(): DeleteTemplateStageUseCase {
		if (!this._deleteTemplateStageUseCase) this._deleteTemplateStageUseCase = new DeleteTemplateStageUseCase(this._traceabilityRepository)
		return this._deleteTemplateStageUseCase
	}

	get listTraceabilitiesUseCase(): ListTraceabilitiesUseCase {
		if (!this._listTraceabilitiesUseCase) this._listTraceabilitiesUseCase = new ListTraceabilitiesUseCase(this._traceabilityRepository)
		return this._listTraceabilitiesUseCase
	}

	get getTraceabilityUseCase(): GetTraceabilityUseCase {
		if (!this._getTraceabilityUseCase) this._getTraceabilityUseCase = new GetTraceabilityUseCase(this._traceabilityRepository)
		return this._getTraceabilityUseCase
	}

	get createTraceabilityUseCase(): CreateTraceabilityUseCase {
		if (!this._createTraceabilityUseCase) this._createTraceabilityUseCase = new CreateTraceabilityUseCase(this._traceabilityRepository)
		return this._createTraceabilityUseCase
	}

	get updateTraceabilityUseCase(): UpdateTraceabilityUseCase {
		if (!this._updateTraceabilityUseCase) this._updateTraceabilityUseCase = new UpdateTraceabilityUseCase(this._traceabilityRepository)
		return this._updateTraceabilityUseCase
	}

	get deleteTraceabilityUseCase(): DeleteTraceabilityUseCase {
		if (!this._deleteTraceabilityUseCase) this._deleteTraceabilityUseCase = new DeleteTraceabilityUseCase(this._traceabilityRepository)
		return this._deleteTraceabilityUseCase
	}

	get tracTriggerService(): TraceabilityAgentTriggerService {
		if (!this._tracTriggerService) {
			this._tracTriggerService = new TraceabilityAgentTriggerService(this._traceabilityRepository, this._agentRepository)
		}
		return this._tracTriggerService
	}

	get createTaskUseCase(): CreateTaskUseCase {
		if (!this._createTaskUseCase) this._createTaskUseCase = new CreateTaskUseCase(this._traceabilityRepository, this.tracTriggerService)
		return this._createTaskUseCase
	}

	get updateTaskUseCase(): UpdateTaskUseCase {
		if (!this._updateTaskUseCase) this._updateTaskUseCase = new UpdateTaskUseCase(this._traceabilityRepository, this.tracTriggerService)
		return this._updateTaskUseCase
	}

	get deleteTaskUseCase(): DeleteTaskUseCase {
		if (!this._deleteTaskUseCase) this._deleteTaskUseCase = new DeleteTaskUseCase(this._traceabilityRepository, this.tracTriggerService)
		return this._deleteTaskUseCase
	}

	get createLinkUseCase(): CreateLinkUseCase {
		if (!this._createLinkUseCase) this._createLinkUseCase = new CreateLinkUseCase(this._traceabilityRepository)
		return this._createLinkUseCase
	}

	get deleteLinkUseCase(): DeleteLinkUseCase {
		if (!this._deleteLinkUseCase) this._deleteLinkUseCase = new DeleteLinkUseCase(this._traceabilityRepository)
		return this._deleteLinkUseCase
	}

	get createDocumentUseCase(): CreateDocumentUseCase {
		if (!this._createDocumentUseCase) this._createDocumentUseCase = new CreateDocumentUseCase(this._traceabilityRepository)
		return this._createDocumentUseCase
	}

	get updateDocumentUseCase(): UpdateDocumentUseCase {
		if (!this._updateDocumentUseCase) this._updateDocumentUseCase = new UpdateDocumentUseCase(this._traceabilityRepository)
		return this._updateDocumentUseCase
	}

	get deleteDocumentUseCase(): DeleteDocumentUseCase {
		if (!this._deleteDocumentUseCase) this._deleteDocumentUseCase = new DeleteDocumentUseCase(this._traceabilityRepository)
		return this._deleteDocumentUseCase
	}

	get getDocumentUseCase(): GetDocumentUseCase {
		if (!this._getDocumentUseCase) this._getDocumentUseCase = new GetDocumentUseCase(this._traceabilityRepository)
		return this._getDocumentUseCase
	}

	get getTemplateByCodeUseCase(): GetTemplateByCodeUseCase {
		if (!this._getTemplateByCodeUseCase) this._getTemplateByCodeUseCase = new GetTemplateByCodeUseCase(this._traceabilityRepository)
		return this._getTemplateByCodeUseCase
	}
}

// Singleton container instance
export const container = new Container()
