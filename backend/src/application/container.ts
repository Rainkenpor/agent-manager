import type {
	IUserRepository,
	IRoleRepository,
	IPermissionRepository,
	IAgentRepository,
} from "@domain/repositories/index.js";

import {
	AgentRepository,
	UserRepository,
	RoleRepository,
	PermissionRepository,
} from "@infra/repository/index.js";

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
} from "./use-cases/index.js";

/**
 * Dependency Injection Container
 * Implements a simple IoC container pattern for managing dependencies
 */
export class Container {
	// Repository instances
	private _userRepository: IUserRepository;
	private _roleRepository: IRoleRepository;
	private _permissionRepository: IPermissionRepository;

	// Auth Use Cases
	private _createUserUseCase?: CreateUserUseCase;
	private _loginUseCase?: LoginUseCase;
	private _checkPermissionUseCase?: CheckPermissionUseCase;
	private _assignRoleUseCase?: AssignRoleUseCase;
	private _assignPermissionUseCase?: AssignPermissionUseCase;

	// Agent Use Cases
	private _agentRepository: IAgentRepository;
	private _createAgentUseCase?: CreateAgentUseCase;
	private _listAgentsUseCase?: ListAgentsUseCase;
	private _getAgentUseCase?: GetAgentUseCase;
	private _updateAgentUseCase?: UpdateAgentUseCase;
	private _deleteAgentUseCase?: DeleteAgentUseCase;

	constructor() {
		// Initialize repositories with concrete implementations
		this._userRepository = new UserRepository();
		this._roleRepository = new RoleRepository();
		this._permissionRepository = new PermissionRepository();
		this._agentRepository = new AgentRepository();
	}

	// ==========================================
	// REPOSITORIES (for testing/mocking)
	// ==========================================

	get userRepository(): IUserRepository {
		return this._userRepository;
	}

	get roleRepository(): IRoleRepository {
		return this._roleRepository;
	}

	get permissionRepository(): IPermissionRepository {
		return this._permissionRepository;
	}

	// ==========================================
	// AUTH & USER USE CASES
	// ==========================================

	get createUserUseCase(): CreateUserUseCase {
		if (!this._createUserUseCase) {
			this._createUserUseCase = new CreateUserUseCase(this._userRepository);
		}
		return this._createUserUseCase;
	}

	get loginUseCase(): LoginUseCase {
		if (!this._loginUseCase) {
			this._loginUseCase = new LoginUseCase(this._userRepository);
		}
		return this._loginUseCase;
	}

	get checkPermissionUseCase(): CheckPermissionUseCase {
		if (!this._checkPermissionUseCase) {
			this._checkPermissionUseCase = new CheckPermissionUseCase(
				this._userRepository,
			);
		}
		return this._checkPermissionUseCase;
	}

	get assignRoleUseCase(): AssignRoleUseCase {
		if (!this._assignRoleUseCase) {
			this._assignRoleUseCase = new AssignRoleUseCase(
				this._userRepository,
				this._roleRepository,
			);
		}
		return this._assignRoleUseCase;
	}

	get assignPermissionUseCase(): AssignPermissionUseCase {
		if (!this._assignPermissionUseCase) {
			this._assignPermissionUseCase = new AssignPermissionUseCase(
				this._roleRepository,
				this._permissionRepository,
			);
		}
		return this._assignPermissionUseCase;
	}

	// ==========================================
	// AGENT USE CASES
	// ==========================================

	get createAgentUseCase(): CreateAgentUseCase {
		if (!this._createAgentUseCase) {
			this._createAgentUseCase = new CreateAgentUseCase(this._agentRepository);
		}
		return this._createAgentUseCase;
	}

	get listAgentsUseCase(): ListAgentsUseCase {
		if (!this._listAgentsUseCase) {
			this._listAgentsUseCase = new ListAgentsUseCase(this._agentRepository);
		}
		return this._listAgentsUseCase;
	}

	get getAgentUseCase(): GetAgentUseCase {
		if (!this._getAgentUseCase) {
			this._getAgentUseCase = new GetAgentUseCase(this._agentRepository);
		}
		return this._getAgentUseCase;
	}

	get updateAgentUseCase(): UpdateAgentUseCase {
		if (!this._updateAgentUseCase) {
			this._updateAgentUseCase = new UpdateAgentUseCase(this._agentRepository);
		}
		return this._updateAgentUseCase;
	}

	get deleteAgentUseCase(): DeleteAgentUseCase {
		if (!this._deleteAgentUseCase) {
			this._deleteAgentUseCase = new DeleteAgentUseCase(this._agentRepository);
		}
		return this._deleteAgentUseCase;
	}
}

// Singleton container instance
export const container = new Container();
