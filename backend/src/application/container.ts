import type {
	IAgentGroupRepository,
	IAgentRepository,
	IChatRepository,
	IEventListenerRepository,
	IGovernanceRepository,
	IGovernanceSuggestionRepository,
	IHookServerRepository,
	IMcpCredentialProvider,
	IMcpServerRepository,
	IMcpUserCredentialRepository,
	IPermissionRepository,
	IPresetQnaRepository,
	IRoleRepository,
	ISkillRepository,
	ITokenAuditRepository,
	ITraceabilityParticipantRepository,
	ITraceabilityRepository,
	IUserRepository
} from '@domain/repositories/index.js'
import {
	AgentGroupRepository,
	AgentRepository,
	ChatRepository,
	EventListenerRepository,
	GovernanceRepository,
	GovernanceSuggestionRepository,
	HookServerRepository,
	McpServerRepository,
	McpUserCredentialRepository,
	PermissionRepository,
	PresetQnaRepository,
	RoleRepository,
	SkillRepository,
	TokenAuditRepository,
	TraceabilityParticipantRepository,
	TraceabilityRepository,
	UserRepository
} from '@infra/repository/index.js'
import { EventListenerExecutorService } from '@infra/service/event-listener-executor.service.js'
import { HookDispatcherService } from '@infra/service/hook-dispatcher.service.js'
import { mcpExternalManager } from '@infra/service/mcp-external.js'
import { TraceabilityAgentTriggerService } from '@infra/service/traceability-agent-trigger.service.js'
import {
	AppendMessageImagesUseCase,
	AssignPermissionUseCase,
	AssignRoleUseCase,
	AssignStageUserUseCase,
	CheckPermissionUseCase,
	CompleteTaskUseCase,
	CreateAgentGroupUseCase,
	// Agent Use Cases
	CreateAgentUseCase,
	// Chat Use Cases
	CreateConversationUseCase,
	CreatePublicConversationUseCase,
	CreateDocumentUseCase,
	// Preset Q&A Use Cases
	DeletePresetQnaUseCase,
	GeneratePresetQnaUseCase,
	ListPresetQnaUseCase,
	MatchPresetQnaUseCase,
	PublicChatAnswerUseCase,
	RefreshPresetQnaUseCase,
	SuggestPresetQnaUseCase,
	// Event Listener Use Cases
	CreateEventListenerUseCase,
	CreateGovernanceSuggestionUseCase,
	CreateGovernanceUseCase,
	CreateLinkUseCase,
	// Skill Use Cases
	CreateSkillUseCase,
	CreateTaskUseCase,
	CreateTemplateStageUseCase,
	CreateTemplateUseCase,
	CreateTraceabilityUseCase,
	// User
	CreateUserUseCase,
	DeleteAgentGroupUseCase,
	DeleteAgentUseCase,
	DeleteConversationUseCase,
	DeleteDocumentUseCase,
	DeleteEventListenerUseCase,
	DeleteGovernanceSuggestionUseCase,
	DeleteGovernanceUseCase,
	DeleteLinkUseCase,
	DeleteMcpCredentialUseCase,
	DeleteSkillUseCase,
	DeleteTaskUseCase,
	DeleteTemplateStageUseCase,
	DeleteTemplateUseCase,
	DeleteTraceabilityUseCase,
	DuplicateAgentUseCase,
	ExportConfigUseCase,
	GetAgentUseCase,
	GetCodexUsageUseCase,
	GetConversationUseCase,
	GetDocumentHistoryUseCase,
	GetDocumentUseCase,
	GetEventListenerUseCase,
	GetGovernanceSuggestionUseCase,
	GetGovernanceUseCase,
	GetLinksByStageUseCase,
	// MCP Credential Use Cases
	GetMcpCredentialsUseCase,
	GetMyStagesUseCase,
	GetSkillUseCase,
	GetSystemMetricsUseCase,
	GetTasksByStageUseCase,
	GetTemplateByCodeUseCase,
	GetTemplateUseCase,
	GetTokenMetricsUseCase,
	GetTraceabilityByCodeUseCase,
	GetTraceabilityByConversationUseCase,
	GetTraceabilityUseCase,
	GetUsersByRoleWithEffortUseCase,
	ImportConfigUseCase,
	// Agent Group Use Cases
	ListAgentGroupsUseCase,
	ListAgentsUseCase,
	ListConversationsUseCase,
	ListEventListenersUseCase,
	ListGovernanceSuggestionsUseCase,
	ListGovernanceUseCase,
	ListMyTraceabilityInvitationsUseCase,
	ListSkillsUseCase,
	// Traceability Use Cases
	ListTemplatesUseCase,
	ListTraceabilitiesUseCase,
	ListTraceabilityParticipantsUseCase,
	LoginUseCase,
	OpenOrCreateChatForTraceabilityUseCase,
	RemoveTraceabilityShareUseCase,
	ShareTraceabilityUseCase,
	StreamAgentLogsUseCase,
	StreamAiAssistUseCase,
	StreamMessageUseCase,
	TruncateMessagesUseCase,
	UpdateAgentGroupUseCase,
	UpdateAgentUseCase,
	UpdateDocumentUseCase,
	UpdateEventListenerUseCase,
	UpdateGovernanceUseCase,
	UpdateSkillUseCase,
	UpdateTaskUseCase,
	UpdateTemplateStageUseCase,
	UpdateTemplateUseCase,
	UpdateTraceabilityUseCase,
	UpsertMcpCredentialUseCase
} from './use-cases/index.js'
import { GetSkillsAllowedForUserUseCase } from './use-cases/skill/get-skills-allowed-user.js'

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
	private readonly _userRepository: IUserRepository
	private readonly _roleRepository: IRoleRepository
	private readonly _permissionRepository: IPermissionRepository
	private readonly _agentRepository: IAgentRepository
	private readonly _agentGroupRepository: IAgentGroupRepository
	// MCP Server Repository
	private readonly _mcpServerRepository: IMcpServerRepository
	// Chat Repository
	private readonly _chatRepository: IChatRepository
	// Preset Q&A Repository
	private readonly _presetQnaRepository: IPresetQnaRepository

	// Auth Use Cases
	private _createUserUseCase?: CreateUserUseCase
	private _loginUseCase?: LoginUseCase
	private _checkPermissionUseCase?: CheckPermissionUseCase
	private _assignRoleUseCase?: AssignRoleUseCase
	private _assignPermissionUseCase?: AssignPermissionUseCase

	// Agent Use Cases
	private _createAgentUseCase?: CreateAgentUseCase
	private _listAgentsUseCase?: ListAgentsUseCase
	private _getAgentUseCase?: GetAgentUseCase
	private _updateAgentUseCase?: UpdateAgentUseCase
	private _deleteAgentUseCase?: DeleteAgentUseCase
	private _duplicateAgentUseCase?: DuplicateAgentUseCase

	// Agent Group Repository & Use Cases
	private _listAgentGroupsUseCase?: ListAgentGroupsUseCase
	private _createAgentGroupUseCase?: CreateAgentGroupUseCase
	private _updateAgentGroupUseCase?: UpdateAgentGroupUseCase
	private _deleteAgentGroupUseCase?: DeleteAgentGroupUseCase

	// Chat Use Cases
	private _createConversationUseCase?: CreateConversationUseCase
	private _createPublicConversationUseCase?: CreatePublicConversationUseCase
	private _listConversationsUseCase?: ListConversationsUseCase
	private _getConversationUseCase?: GetConversationUseCase
	private _deleteConversationUseCase?: DeleteConversationUseCase
	private _streamMessageUseCase?: StreamMessageUseCase
	private _truncateMessagesUseCase?: TruncateMessagesUseCase
	private _appendMessageImagesUseCase?: AppendMessageImagesUseCase

	// Preset Q&A Use Cases
	private _matchPresetQnaUseCase?: MatchPresetQnaUseCase
	private _suggestPresetQnaUseCase?: SuggestPresetQnaUseCase
	private _generatePresetQnaUseCase?: GeneratePresetQnaUseCase
	private _listPresetQnaUseCase?: ListPresetQnaUseCase
	private _deletePresetQnaUseCase?: DeletePresetQnaUseCase
	private _refreshPresetQnaUseCase?: RefreshPresetQnaUseCase
	private _publicChatAnswerUseCase?: PublicChatAnswerUseCase

	// MCP User Credential Repository & Use Cases
	private readonly _mcpUserCredentialRepository: IMcpUserCredentialRepository
	private _getMcpCredentialsUseCase?: GetMcpCredentialsUseCase
	private _upsertMcpCredentialUseCase?: UpsertMcpCredentialUseCase
	private _deleteMcpCredentialUseCase?: DeleteMcpCredentialUseCase

	// Governance Repository & Use Cases
	private readonly _governanceRepository: IGovernanceRepository
	private _listGovernanceUseCase?: ListGovernanceUseCase
	private _getGovernanceUseCase?: GetGovernanceUseCase
	private _createGovernanceUseCase?: CreateGovernanceUseCase
	private _updateGovernanceUseCase?: UpdateGovernanceUseCase
	private _deleteGovernanceUseCase?: DeleteGovernanceUseCase

	// Governance Suggestion Repository & Use Cases
	private readonly _governanceSuggestionRepository: IGovernanceSuggestionRepository
	private _createGovernanceSuggestionUseCase?: CreateGovernanceSuggestionUseCase
	private _listGovernanceSuggestionsUseCase?: ListGovernanceSuggestionsUseCase
	private _getGovernanceSuggestionUseCase?: GetGovernanceSuggestionUseCase
	private _deleteGovernanceSuggestionUseCase?: DeleteGovernanceSuggestionUseCase

	// Skill Repository & Use Cases
	private readonly _skillRepository: ISkillRepository
	private _createSkillUseCase?: CreateSkillUseCase
	private _listSkillsUseCase?: ListSkillsUseCase
	private _getSkillsAllowedForUserUseCase?: GetSkillsAllowedForUserUseCase
	private _getSkillUseCase?: GetSkillUseCase
	private _updateSkillUseCase?: UpdateSkillUseCase
	private _deleteSkillUseCase?: DeleteSkillUseCase

	// Hook Server Repository & Dispatcher
	private readonly _hookServerRepository: IHookServerRepository
	private _hookDispatcher?: HookDispatcherService

	// Event Listener Repository, Use Cases & Executor
	private readonly _eventListenerRepository: IEventListenerRepository
	private _createEventListenerUseCase?: CreateEventListenerUseCase
	private _listEventListenersUseCase?: ListEventListenersUseCase
	private _getEventListenerUseCase?: GetEventListenerUseCase
	private _updateEventListenerUseCase?: UpdateEventListenerUseCase
	private _deleteEventListenerUseCase?: DeleteEventListenerUseCase
	private _eventListenerExecutor?: EventListenerExecutorService

	// Traceability Repository & Use Cases
	private readonly _traceabilityRepository: ITraceabilityRepository
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
	private _getTraceabilityByCodeUseCase?: GetTraceabilityByCodeUseCase
	private _createTraceabilityUseCase?: CreateTraceabilityUseCase
	private _updateTraceabilityUseCase?: UpdateTraceabilityUseCase
	private _deleteTraceabilityUseCase?: DeleteTraceabilityUseCase
	private _createTaskUseCase?: CreateTaskUseCase
	private _updateTaskUseCase?: UpdateTaskUseCase
	private _completeTaskUseCase?: CompleteTaskUseCase
	private _deleteTaskUseCase?: DeleteTaskUseCase
	private _getTasksByStageUseCase?: GetTasksByStageUseCase
	private _createLinkUseCase?: CreateLinkUseCase
	private _deleteLinkUseCase?: DeleteLinkUseCase
	private _getLinksByStageUseCase?: GetLinksByStageUseCase
	private _createDocumentUseCase?: CreateDocumentUseCase
	private _updateDocumentUseCase?: UpdateDocumentUseCase
	private _deleteDocumentUseCase?: DeleteDocumentUseCase
	private _getDocumentUseCase?: GetDocumentUseCase
	private _getDocumentHistoryUseCase?: GetDocumentHistoryUseCase
	private _getTemplateByCodeUseCase?: GetTemplateByCodeUseCase
	private _getUsersByRoleWithEffortUseCase?: GetUsersByRoleWithEffortUseCase
	private _assignStageUserUseCase?: AssignStageUserUseCase
	private _getMyStagesUseCase?: GetMyStagesUseCase
	private _getTraceabilityByConversationUseCase?: GetTraceabilityByConversationUseCase
	private readonly _traceabilityParticipantRepository: ITraceabilityParticipantRepository
	private _shareTraceabilityUseCase?: ShareTraceabilityUseCase
	private _removeTraceabilityShareUseCase?: RemoveTraceabilityShareUseCase
	private _listTraceabilityParticipantsUseCase?: ListTraceabilityParticipantsUseCase
	private _listMyTraceabilityInvitationsUseCase?: ListMyTraceabilityInvitationsUseCase
	private _openOrCreateChatForTraceabilityUseCase?: OpenOrCreateChatForTraceabilityUseCase
	private _streamAgentLogsUseCase?: StreamAgentLogsUseCase
	private _streamAiAssistUseCase?: StreamAiAssistUseCase

	// Config Use Cases
	private _exportConfigUseCase?: ExportConfigUseCase
	private _importConfigUseCase?: ImportConfigUseCase

	// Token Audit Repository & Use Cases
	readonly tokenAuditRepository: ITokenAuditRepository
	private _getTokenMetricsUseCase?: GetTokenMetricsUseCase
	private _getCodexUsageUseCase?: GetCodexUsageUseCase
	private _getSystemMetricsUseCase?: GetSystemMetricsUseCase

	constructor() {
		// Initialize repositories with concrete implementations
		this._userRepository = new UserRepository()
		this._roleRepository = new RoleRepository()
		this._permissionRepository = new PermissionRepository()
		this._agentRepository = new AgentRepository()
		this._agentGroupRepository = new AgentGroupRepository()
		this._mcpServerRepository = new McpServerRepository()
		this._chatRepository = new ChatRepository()
		this._presetQnaRepository = new PresetQnaRepository()
		this._mcpUserCredentialRepository = new McpUserCredentialRepository()
		this._skillRepository = new SkillRepository()
		this._governanceRepository = new GovernanceRepository()
		this._governanceSuggestionRepository = new GovernanceSuggestionRepository()
		this._traceabilityRepository = new TraceabilityRepository()
		this._traceabilityParticipantRepository = new TraceabilityParticipantRepository()
		this._hookServerRepository = new HookServerRepository()
		this._eventListenerRepository = new EventListenerRepository()
		this.tokenAuditRepository = new TokenAuditRepository()

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
	// AGENT GROUP USE CASES
	// ==========================================

	get agentGroupRepository(): IAgentGroupRepository {
		return this._agentGroupRepository
	}

	get listAgentGroupsUseCase(): ListAgentGroupsUseCase {
		if (!this._listAgentGroupsUseCase) this._listAgentGroupsUseCase = new ListAgentGroupsUseCase(this._agentGroupRepository)
		return this._listAgentGroupsUseCase
	}

	get createAgentGroupUseCase(): CreateAgentGroupUseCase {
		if (!this._createAgentGroupUseCase) this._createAgentGroupUseCase = new CreateAgentGroupUseCase(this._agentGroupRepository)
		return this._createAgentGroupUseCase
	}

	get updateAgentGroupUseCase(): UpdateAgentGroupUseCase {
		if (!this._updateAgentGroupUseCase) this._updateAgentGroupUseCase = new UpdateAgentGroupUseCase(this._agentGroupRepository)
		return this._updateAgentGroupUseCase
	}

	get deleteAgentGroupUseCase(): DeleteAgentGroupUseCase {
		if (!this._deleteAgentGroupUseCase) this._deleteAgentGroupUseCase = new DeleteAgentGroupUseCase(this._agentGroupRepository)
		return this._deleteAgentGroupUseCase
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

	get createPublicConversationUseCase(): CreatePublicConversationUseCase {
		if (!this._createPublicConversationUseCase) {
			this._createPublicConversationUseCase = new CreatePublicConversationUseCase(this._chatRepository, this._agentRepository)
		}
		return this._createPublicConversationUseCase
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

	get truncateMessagesUseCase(): TruncateMessagesUseCase {
		if (!this._truncateMessagesUseCase) {
			this._truncateMessagesUseCase = new TruncateMessagesUseCase(this._chatRepository)
		}
		return this._truncateMessagesUseCase
	}

	get appendMessageImagesUseCase(): AppendMessageImagesUseCase {
		if (!this._appendMessageImagesUseCase) {
			this._appendMessageImagesUseCase = new AppendMessageImagesUseCase(this._chatRepository)
		}
		return this._appendMessageImagesUseCase
	}

	// ==========================================
	// PRESET Q&A USE CASES
	// ==========================================

	get presetQnaRepository(): IPresetQnaRepository {
		return this._presetQnaRepository
	}

	get matchPresetQnaUseCase(): MatchPresetQnaUseCase {
		if (!this._matchPresetQnaUseCase) {
			this._matchPresetQnaUseCase = new MatchPresetQnaUseCase(this._presetQnaRepository)
		}
		return this._matchPresetQnaUseCase
	}

	get suggestPresetQnaUseCase(): SuggestPresetQnaUseCase {
		if (!this._suggestPresetQnaUseCase) {
			this._suggestPresetQnaUseCase = new SuggestPresetQnaUseCase(this._presetQnaRepository)
		}
		return this._suggestPresetQnaUseCase
	}

	get generatePresetQnaUseCase(): GeneratePresetQnaUseCase {
		if (!this._generatePresetQnaUseCase) {
			this._generatePresetQnaUseCase = new GeneratePresetQnaUseCase(this._presetQnaRepository, this._agentRepository)
		}
		return this._generatePresetQnaUseCase
	}

	get listPresetQnaUseCase(): ListPresetQnaUseCase {
		if (!this._listPresetQnaUseCase) {
			this._listPresetQnaUseCase = new ListPresetQnaUseCase(this._presetQnaRepository)
		}
		return this._listPresetQnaUseCase
	}

	get deletePresetQnaUseCase(): DeletePresetQnaUseCase {
		if (!this._deletePresetQnaUseCase) {
			this._deletePresetQnaUseCase = new DeletePresetQnaUseCase(this._presetQnaRepository)
		}
		return this._deletePresetQnaUseCase
	}

	get refreshPresetQnaUseCase(): RefreshPresetQnaUseCase {
		if (!this._refreshPresetQnaUseCase) {
			this._refreshPresetQnaUseCase = new RefreshPresetQnaUseCase(this._presetQnaRepository, this._agentRepository)
		}
		return this._refreshPresetQnaUseCase
	}

	get publicChatAnswerUseCase(): PublicChatAnswerUseCase {
		if (!this._publicChatAnswerUseCase) {
			this._publicChatAnswerUseCase = new PublicChatAnswerUseCase(
				this._chatRepository,
				this.matchPresetQnaUseCase,
				this.streamMessageUseCase,
				this.generatePresetQnaUseCase
			)
		}
		return this._publicChatAnswerUseCase
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
	// GOVERNANCE REPOSITORY (direct access)
	// ==========================================

	get governanceRepository(): IGovernanceRepository {
		return this._governanceRepository
	}

	get traceabilityRepository(): ITraceabilityRepository {
		return this._traceabilityRepository
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

	get getTraceabilityByCodeUseCase(): GetTraceabilityByCodeUseCase {
		if (!this._getTraceabilityByCodeUseCase)
			this._getTraceabilityByCodeUseCase = new GetTraceabilityByCodeUseCase(this._traceabilityRepository)
		return this._getTraceabilityByCodeUseCase
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
		if (!this._createTaskUseCase)
			this._createTaskUseCase = new CreateTaskUseCase(
				this._traceabilityRepository,
				this.tracTriggerService,
				this._eventListenerRepository,
				this.eventListenerExecutor
			)
		return this._createTaskUseCase
	}

	get updateTaskUseCase(): UpdateTaskUseCase {
		if (!this._updateTaskUseCase) this._updateTaskUseCase = new UpdateTaskUseCase(this._traceabilityRepository, this.tracTriggerService)
		return this._updateTaskUseCase
	}

	get completeTaskUseCase(): CompleteTaskUseCase {
		if (!this._completeTaskUseCase)
			this._completeTaskUseCase = new CompleteTaskUseCase(this._traceabilityRepository, this.tracTriggerService)
		return this._completeTaskUseCase
	}

	get deleteTaskUseCase(): DeleteTaskUseCase {
		if (!this._deleteTaskUseCase) this._deleteTaskUseCase = new DeleteTaskUseCase(this._traceabilityRepository, this.tracTriggerService)
		return this._deleteTaskUseCase
	}

	get getTasksByStageUseCase(): GetTasksByStageUseCase {
		if (!this._getTasksByStageUseCase) this._getTasksByStageUseCase = new GetTasksByStageUseCase(this._traceabilityRepository)
		return this._getTasksByStageUseCase
	}

	get createLinkUseCase(): CreateLinkUseCase {
		if (!this._createLinkUseCase) this._createLinkUseCase = new CreateLinkUseCase(this._traceabilityRepository)
		return this._createLinkUseCase
	}

	get deleteLinkUseCase(): DeleteLinkUseCase {
		if (!this._deleteLinkUseCase) this._deleteLinkUseCase = new DeleteLinkUseCase(this._traceabilityRepository)
		return this._deleteLinkUseCase
	}

	get getLinksByStageUseCase(): GetLinksByStageUseCase {
		if (!this._getLinksByStageUseCase) this._getLinksByStageUseCase = new GetLinksByStageUseCase(this._traceabilityRepository)
		return this._getLinksByStageUseCase
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

	get getDocumentHistoryUseCase(): GetDocumentHistoryUseCase {
		if (!this._getDocumentHistoryUseCase) this._getDocumentHistoryUseCase = new GetDocumentHistoryUseCase(this._traceabilityRepository)
		return this._getDocumentHistoryUseCase
	}

	get getTemplateByCodeUseCase(): GetTemplateByCodeUseCase {
		if (!this._getTemplateByCodeUseCase) this._getTemplateByCodeUseCase = new GetTemplateByCodeUseCase(this._traceabilityRepository)
		return this._getTemplateByCodeUseCase
	}

	get getUsersByRoleWithEffortUseCase(): GetUsersByRoleWithEffortUseCase {
		if (!this._getUsersByRoleWithEffortUseCase)
			this._getUsersByRoleWithEffortUseCase = new GetUsersByRoleWithEffortUseCase(this._traceabilityRepository)
		return this._getUsersByRoleWithEffortUseCase
	}

	get assignStageUserUseCase(): AssignStageUserUseCase {
		if (!this._assignStageUserUseCase) this._assignStageUserUseCase = new AssignStageUserUseCase(this._traceabilityRepository)
		return this._assignStageUserUseCase
	}

	get getMyStagesUseCase(): GetMyStagesUseCase {
		if (!this._getMyStagesUseCase) this._getMyStagesUseCase = new GetMyStagesUseCase(this._traceabilityRepository)
		return this._getMyStagesUseCase
	}

	get getTraceabilityByConversationUseCase(): GetTraceabilityByConversationUseCase {
		if (!this._getTraceabilityByConversationUseCase)
			this._getTraceabilityByConversationUseCase = new GetTraceabilityByConversationUseCase(this._traceabilityRepository)
		return this._getTraceabilityByConversationUseCase
	}

	// ==========================================
	// TRACEABILITY PARTICIPANT USE CASES
	// ==========================================

	get traceabilityParticipantRepository(): ITraceabilityParticipantRepository {
		return this._traceabilityParticipantRepository
	}

	get shareTraceabilityUseCase(): ShareTraceabilityUseCase {
		if (!this._shareTraceabilityUseCase)
			this._shareTraceabilityUseCase = new ShareTraceabilityUseCase(
				this._traceabilityParticipantRepository,
				this._traceabilityRepository,
				this._userRepository
			)
		return this._shareTraceabilityUseCase
	}

	get removeTraceabilityShareUseCase(): RemoveTraceabilityShareUseCase {
		if (!this._removeTraceabilityShareUseCase)
			this._removeTraceabilityShareUseCase = new RemoveTraceabilityShareUseCase(
				this._traceabilityParticipantRepository,
				this._chatRepository
			)
		return this._removeTraceabilityShareUseCase
	}

	get listTraceabilityParticipantsUseCase(): ListTraceabilityParticipantsUseCase {
		if (!this._listTraceabilityParticipantsUseCase)
			this._listTraceabilityParticipantsUseCase = new ListTraceabilityParticipantsUseCase(
				this._traceabilityParticipantRepository,
				this._traceabilityRepository,
				this._userRepository
			)
		return this._listTraceabilityParticipantsUseCase
	}

	get listMyTraceabilityInvitationsUseCase(): ListMyTraceabilityInvitationsUseCase {
		if (!this._listMyTraceabilityInvitationsUseCase)
			this._listMyTraceabilityInvitationsUseCase = new ListMyTraceabilityInvitationsUseCase(this._traceabilityParticipantRepository)
		return this._listMyTraceabilityInvitationsUseCase
	}

	get openOrCreateChatForTraceabilityUseCase(): OpenOrCreateChatForTraceabilityUseCase {
		if (!this._openOrCreateChatForTraceabilityUseCase)
			this._openOrCreateChatForTraceabilityUseCase = new OpenOrCreateChatForTraceabilityUseCase(
				this._traceabilityParticipantRepository,
				this._traceabilityRepository,
				this._chatRepository,
				this._userRepository
			)
		return this._openOrCreateChatForTraceabilityUseCase
	}

	// ==========================================
	// HOOK SERVER
	// ==========================================

	get hookServerRepository(): IHookServerRepository {
		return this._hookServerRepository
	}

	get hookDispatcher(): HookDispatcherService {
		if (!this._hookDispatcher) {
			this._hookDispatcher = new HookDispatcherService(this._hookServerRepository)
		}
		return this._hookDispatcher
	}

	// ==========================================
	// LOGS USE CASES
	// ==========================================

	get streamAgentLogsUseCase(): StreamAgentLogsUseCase {
		if (!this._streamAgentLogsUseCase) this._streamAgentLogsUseCase = new StreamAgentLogsUseCase()
		return this._streamAgentLogsUseCase
	}

	get streamAiAssistUseCase(): StreamAiAssistUseCase {
		if (!this._streamAiAssistUseCase) this._streamAiAssistUseCase = new StreamAiAssistUseCase()
		return this._streamAiAssistUseCase
	}

	// ==========================================
	// GOVERNANCE USE CASES
	// ==========================================

	get listGovernanceUseCase(): ListGovernanceUseCase {
		if (!this._listGovernanceUseCase) this._listGovernanceUseCase = new ListGovernanceUseCase(this._governanceRepository)
		return this._listGovernanceUseCase
	}

	get getGovernanceUseCase(): GetGovernanceUseCase {
		if (!this._getGovernanceUseCase) this._getGovernanceUseCase = new GetGovernanceUseCase(this._governanceRepository)
		return this._getGovernanceUseCase
	}

	get createGovernanceUseCase(): CreateGovernanceUseCase {
		if (!this._createGovernanceUseCase) this._createGovernanceUseCase = new CreateGovernanceUseCase(this._governanceRepository)
		return this._createGovernanceUseCase
	}

	get updateGovernanceUseCase(): UpdateGovernanceUseCase {
		if (!this._updateGovernanceUseCase) this._updateGovernanceUseCase = new UpdateGovernanceUseCase(this._governanceRepository)
		return this._updateGovernanceUseCase
	}

	get deleteGovernanceUseCase(): DeleteGovernanceUseCase {
		if (!this._deleteGovernanceUseCase) this._deleteGovernanceUseCase = new DeleteGovernanceUseCase(this._governanceRepository)
		return this._deleteGovernanceUseCase
	}

	// ==========================================
	// GOVERNANCE SUGGESTION USE CASES
	// ==========================================

	get governanceSuggestionRepository(): IGovernanceSuggestionRepository {
		return this._governanceSuggestionRepository
	}

	get createGovernanceSuggestionUseCase(): CreateGovernanceSuggestionUseCase {
		if (!this._createGovernanceSuggestionUseCase)
			this._createGovernanceSuggestionUseCase = new CreateGovernanceSuggestionUseCase(this._governanceSuggestionRepository)
		return this._createGovernanceSuggestionUseCase
	}

	get listGovernanceSuggestionsUseCase(): ListGovernanceSuggestionsUseCase {
		if (!this._listGovernanceSuggestionsUseCase)
			this._listGovernanceSuggestionsUseCase = new ListGovernanceSuggestionsUseCase(this._governanceSuggestionRepository)
		return this._listGovernanceSuggestionsUseCase
	}

	get getGovernanceSuggestionUseCase(): GetGovernanceSuggestionUseCase {
		if (!this._getGovernanceSuggestionUseCase)
			this._getGovernanceSuggestionUseCase = new GetGovernanceSuggestionUseCase(this._governanceSuggestionRepository)
		return this._getGovernanceSuggestionUseCase
	}

	get deleteGovernanceSuggestionUseCase(): DeleteGovernanceSuggestionUseCase {
		if (!this._deleteGovernanceSuggestionUseCase)
			this._deleteGovernanceSuggestionUseCase = new DeleteGovernanceSuggestionUseCase(this._governanceSuggestionRepository)
		return this._deleteGovernanceSuggestionUseCase
	}

	// ==========================================
	// EVENT LISTENER USE CASES & EXECUTOR
	// ==========================================

	get createEventListenerUseCase(): CreateEventListenerUseCase {
		if (!this._createEventListenerUseCase) this._createEventListenerUseCase = new CreateEventListenerUseCase(this._eventListenerRepository)
		return this._createEventListenerUseCase
	}

	get listEventListenersUseCase(): ListEventListenersUseCase {
		if (!this._listEventListenersUseCase) this._listEventListenersUseCase = new ListEventListenersUseCase(this._eventListenerRepository)
		return this._listEventListenersUseCase
	}

	get getEventListenerUseCase(): GetEventListenerUseCase {
		if (!this._getEventListenerUseCase) this._getEventListenerUseCase = new GetEventListenerUseCase(this._eventListenerRepository)
		return this._getEventListenerUseCase
	}

	get updateEventListenerUseCase(): UpdateEventListenerUseCase {
		if (!this._updateEventListenerUseCase) this._updateEventListenerUseCase = new UpdateEventListenerUseCase(this._eventListenerRepository)
		return this._updateEventListenerUseCase
	}

	get deleteEventListenerUseCase(): DeleteEventListenerUseCase {
		if (!this._deleteEventListenerUseCase) this._deleteEventListenerUseCase = new DeleteEventListenerUseCase(this._eventListenerRepository)
		return this._deleteEventListenerUseCase
	}

	get eventListenerExecutor(): EventListenerExecutorService {
		if (!this._eventListenerExecutor) this._eventListenerExecutor = new EventListenerExecutorService(this._eventListenerRepository)
		return this._eventListenerExecutor
	}

	// ==========================================
	// CONFIG USE CASES
	// ==========================================

	get exportConfigUseCase(): ExportConfigUseCase {
		if (!this._exportConfigUseCase)
			this._exportConfigUseCase = new ExportConfigUseCase(
				this._agentRepository,
				this._skillRepository,
				this._mcpServerRepository,
				this._traceabilityRepository,
				this._roleRepository,
				this._userRepository,
				this._permissionRepository
			)
		return this._exportConfigUseCase
	}

	get importConfigUseCase(): ImportConfigUseCase {
		if (!this._importConfigUseCase)
			this._importConfigUseCase = new ImportConfigUseCase(
				this._agentRepository,
				this._skillRepository,
				this._mcpServerRepository,
				this._traceabilityRepository,
				this._roleRepository,
				this._userRepository,
				this._permissionRepository
			)
		return this._importConfigUseCase
	}

	// ==========================================
	// TOKEN AUDIT USE CASES
	// ==========================================

	get getTokenMetricsUseCase(): GetTokenMetricsUseCase {
		if (!this._getTokenMetricsUseCase) {
			this._getTokenMetricsUseCase = new GetTokenMetricsUseCase(this.tokenAuditRepository)
		}
		return this._getTokenMetricsUseCase
	}

	get getCodexUsageUseCase(): GetCodexUsageUseCase {
		if (!this._getCodexUsageUseCase) {
			this._getCodexUsageUseCase = new GetCodexUsageUseCase()
		}
		return this._getCodexUsageUseCase
	}

	get getSystemMetricsUseCase(): GetSystemMetricsUseCase {
		if (!this._getSystemMetricsUseCase) {
			this._getSystemMetricsUseCase = new GetSystemMetricsUseCase()
		}
		return this._getSystemMetricsUseCase
	}
}

// Singleton container instance
export const container = new Container()
