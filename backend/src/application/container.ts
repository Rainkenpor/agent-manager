import type {
	IUserRepository,
	IRoleRepository,
	IPermissionRepository,
	IAgentRepository,
	IMcpServerRepository,
	IChatRepository,
	IMcpUserCredentialRepository,
	IMcpCredentialProvider,
	ISkillRepository
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
	SkillRepository
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
	DeleteSkillUseCase
} from './use-cases/index.js'

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
	private _getSkillUseCase?: GetSkillUseCase
	private _updateSkillUseCase?: UpdateSkillUseCase
	private _deleteSkillUseCase?: DeleteSkillUseCase

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
}

// Singleton container instance
export const container = new Container()
