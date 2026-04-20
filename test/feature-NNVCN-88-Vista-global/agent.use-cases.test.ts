import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	CreateAgentUseCase,
	ListAgentsUseCase,
	GetAgentUseCase,
	UpdateAgentUseCase,
	DeleteAgentUseCase,
	DuplicateAgentUseCase,
} from '../../backend/src/application/use-cases/agent/index.js';
import type { IAgentRepository } from '../../backend/src/domain/repositories/agent.repository.js';
import type { AgentWithSubagents, CreateAgentDTO, UpdateAgentDTO } from '../../backend/src/domain/entities/agent.entity.js';

// Mock the repository module
vi.mock('@domain/repositories/agent.repository.js', () => ({
	IAgentRepository: {},
}));

// Mock the entity module to avoid circular dependency issues
vi.mock('@domain/entities/agent.entity.js', () => ({}));

// Helper function to create a mock agent
const createMockAgent = (overrides: Partial<AgentWithSubagents> = {}): AgentWithSubagents => ({
	id: 'agent-1',
	name: 'Test Agent',
	slug: 'test-agent',
	description: 'A test agent',
	mode: 'primary',
	model: 'gpt-4',
	temperature: '0.7',
	tools: { tool1: true, tool2: false },
	content: 'Test content',
	isActive: true,
	useByChat: false,
	createdAt: '2024-01-01T00:00:00.000Z',
	updatedAt: '2024-01-01T00:00:00.000Z',
	subagents: [],
	...overrides,
});

// Helper function to create a mock repository
const createMockRepository = (): IAgentRepository =>
	({
		create: vi.fn(),
		findAll: vi.fn(),
		findById: vi.fn(),
		findBySlug: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
		setSubagents: vi.fn(),
		getSubagents: vi.fn(),
	}) as unknown as IAgentRepository;

describe('Agent Use Cases', () => {
	describe('CreateAgentUseCase', () => {
		let mockRepository: IAgentRepository;
		let createAgentUseCase: CreateAgentUseCase;

		beforeEach(() => {
			mockRepository = createMockRepository();
			createAgentUseCase = new CreateAgentUseCase(mockRepository);
			vi.clearAllMocks();
		});

		it('should create an agent successfully when slug is unique', async () => {
			const input: CreateAgentDTO = {
				name: 'New Agent',
				slug: 'new-agent',
				description: 'A new agent',
				mode: 'primary',
				model: 'gpt-4',
				temperature: '0.7',
				tools: { tool1: true },
				content: 'Agent content',
			};

			const expectedAgent = createMockAgent({ name: input.name, slug: input.slug });

			vi.mocked(mockRepository.findBySlug).mockResolvedValue(undefined);
			vi.mocked(mockRepository.create).mockResolvedValue(expectedAgent);

			const result = await createAgentUseCase.execute(input);

			expect(result).toEqual({ success: true, data: expectedAgent });
			expect(mockRepository.findBySlug).toHaveBeenCalledWith(input.slug);
			expect(mockRepository.create).toHaveBeenCalledWith(input);
		});

		it('should return error when slug already exists', async () => {
			const input: CreateAgentDTO = {
				name: 'Duplicate Agent',
				slug: 'existing-slug',
				mode: 'primary',
				model: 'gpt-4',
				temperature: '0.7',
				tools: {},
				content: 'Content',
			};

			const existingAgent = createMockAgent({ slug: input.slug });

			vi.mocked(mockRepository.findBySlug).mockResolvedValue(existingAgent);

			const result = await createAgentUseCase.execute(input);

			expect(result).toEqual({
				success: false,
				error: `Ya existe un agente con el slug '${input.slug}'`,
			});
			expect(mockRepository.create).not.toHaveBeenCalled();
		});

		it('should handle repository errors gracefully', async () => {
			const input: CreateAgentDTO = {
				name: 'Error Agent',
				slug: 'error-agent',
				mode: 'primary',
				model: 'gpt-4',
				temperature: '0.7',
				tools: {},
				content: 'Content',
			};

			vi.mocked(mockRepository.findBySlug).mockRejectedValue(new Error('Database connection failed'));

			const result = await createAgentUseCase.execute(input);

			expect(result).toEqual({
				success: false,
				error: 'Error al crear agente: Database connection failed',
			});
		});
	});

	describe('ListAgentsUseCase', () => {
		let mockRepository: IAgentRepository;
		let listAgentsUseCase: ListAgentsUseCase;

		beforeEach(() => {
			mockRepository = createMockRepository();
			listAgentsUseCase = new ListAgentsUseCase(mockRepository);
			vi.clearAllMocks();
		});

		it('should return list of agents successfully', async () => {
			const agents = [
				createMockAgent({ id: 'agent-1', name: 'Agent 1' }),
				createMockAgent({ id: 'agent-2', name: 'Agent 2' }),
				createMockAgent({ id: 'agent-3', name: 'Agent 3' }),
			];

			vi.mocked(mockRepository.findAll).mockResolvedValue(agents);

			const result = await listAgentsUseCase.execute();

			expect(result).toEqual({ success: true, data: agents });
			expect(mockRepository.findAll).toHaveBeenCalledWith();
		});

		it('should handle empty list', async () => {
			vi.mocked(mockRepository.findAll).mockResolvedValue([]);

			const result = await listAgentsUseCase.execute();

			expect(result).toEqual({ success: true, data: [] });
		});

		it('should handle repository errors', async () => {
			vi.mocked(mockRepository.findAll).mockRejectedValue(new Error('Database error'));

			const result = await listAgentsUseCase.execute();

			expect(result).toEqual({
				success: false,
				error: 'Error al listar agentes: Database error',
			});
		});
	});

	describe('GetAgentUseCase', () => {
		let mockRepository: IAgentRepository;
		let getAgentUseCase: GetAgentUseCase;

		beforeEach(() => {
			mockRepository = createMockRepository();
			getAgentUseCase = new GetAgentUseCase(mockRepository);
			vi.clearAllMocks();
		});

		it('should return agent when found', async () => {
			const agentId = 'agent-123';
			const expectedAgent = createMockAgent({ id: agentId, name: 'Found Agent' });

			vi.mocked(mockRepository.findById).mockResolvedValue(expectedAgent);

			const result = await getAgentUseCase.execute(agentId);

			expect(result).toEqual({ success: true, data: expectedAgent });
			expect(mockRepository.findById).toHaveBeenCalledWith(agentId);
		});

		it('should return null when agent not found', async () => {
			const agentId = 'non-existent-id';

			vi.mocked(mockRepository.findById).mockResolvedValue(undefined);

			const result = await getAgentUseCase.execute(agentId);

			expect(result).toEqual({
				success: false,
				error: 'Agente no encontrado',
			});
		});

		it('should handle repository errors', async () => {
			const agentId = 'agent-error';

			vi.mocked(mockRepository.findById).mockRejectedValue(new Error('Connection timeout'));

			const result = await getAgentUseCase.execute(agentId);

			expect(result).toEqual({
				success: false,
				error: 'Error al obtener agente: Connection timeout',
			});
		});
	});

	describe('UpdateAgentUseCase', () => {
		let mockRepository: IAgentRepository;
		let updateAgentUseCase: UpdateAgentUseCase;

		beforeEach(() => {
			mockRepository = createMockRepository();
			updateAgentUseCase = new UpdateAgentUseCase(mockRepository);
			vi.clearAllMocks();
		});

		it('should update agent successfully', async () => {
			const input: UpdateAgentDTO = {
				id: 'agent-1',
				name: 'Updated Agent Name',
			};

			const existingAgent = createMockAgent({ id: input.id });
			const updatedAgent = createMockAgent({ id: input.id, name: input.name });

			vi.mocked(mockRepository.findById).mockResolvedValue(existingAgent);
			vi.mocked(mockRepository.update).mockResolvedValue(updatedAgent);

			const result = await updateAgentUseCase.execute(input);

			expect(result).toEqual({ success: true, data: updatedAgent });
			expect(mockRepository.findById).toHaveBeenCalledWith(input.id);
			expect(mockRepository.update).toHaveBeenCalledWith(input);
		});

		it('should return null when agent not found', async () => {
			const input: UpdateAgentDTO = {
				id: 'non-existent-id',
				name: 'New Name',
			};

			vi.mocked(mockRepository.findById).mockResolvedValue(undefined);

			const result = await updateAgentUseCase.execute(input);

			expect(result).toEqual({
				success: false,
				error: 'Agente no encontrado',
			});
			expect(mockRepository.update).not.toHaveBeenCalled();
		});

		it('should handle repository errors', async () => {
			const input: UpdateAgentDTO = {
				id: 'agent-error',
				name: 'Error Update',
			};

			vi.mocked(mockRepository.findById).mockRejectedValue(new Error('Database failure'));

			const result = await updateAgentUseCase.execute(input);

			expect(result).toEqual({
				success: false,
				error: 'Error al actualizar agente: Database failure',
			});
		});

		it('should return error when new slug already exists', async () => {
			const input: UpdateAgentDTO = {
				id: 'agent-1',
				slug: 'existing-slug',
			};

			const existingAgent = createMockAgent({ id: input.id, slug: 'original-slug' });
			const slugConflictAgent = createMockAgent({ slug: input.slug });

			vi.mocked(mockRepository.findById).mockResolvedValue(existingAgent);
			vi.mocked(mockRepository.findBySlug).mockResolvedValue(slugConflictAgent);

			const result = await updateAgentUseCase.execute(input);

			expect(result).toEqual({
				success: false,
				error: `Ya existe un agente con el slug '${input.slug}'`,
			});
			expect(mockRepository.update).not.toHaveBeenCalled();
		});
	});

	describe('DeleteAgentUseCase', () => {
		let mockRepository: IAgentRepository;
		let deleteAgentUseCase: DeleteAgentUseCase;

		beforeEach(() => {
			mockRepository = createMockRepository();
			deleteAgentUseCase = new DeleteAgentUseCase(mockRepository);
			vi.clearAllMocks();
		});

		it('should delete agent successfully', async () => {
			const agentId = 'agent-to-delete';
			const existingAgent = createMockAgent({ id: agentId });

			vi.mocked(mockRepository.findById).mockResolvedValue(existingAgent);
			vi.mocked(mockRepository.delete).mockResolvedValue(true);

			const result = await deleteAgentUseCase.execute(agentId);

			expect(result).toEqual({ success: true });
			expect(mockRepository.findById).toHaveBeenCalledWith(agentId);
			expect(mockRepository.delete).toHaveBeenCalledWith(agentId);
		});

		it('should return error when agent not found', async () => {
			const agentId = 'non-existent-id';

			vi.mocked(mockRepository.findById).mockResolvedValue(undefined);

			const result = await deleteAgentUseCase.execute(agentId);

			expect(result).toEqual({
				success: false,
				error: 'Agente no encontrado',
			});
			expect(mockRepository.delete).not.toHaveBeenCalled();
		});

		it('should handle repository errors', async () => {
			const agentId = 'agent-error';

			vi.mocked(mockRepository.findById).mockRejectedValue(new Error('Delete failed'));

			const result = await deleteAgentUseCase.execute(agentId);

			expect(result).toEqual({
				success: false,
				error: 'Error al eliminar agente: Delete failed',
			});
		});
	});

	describe('DuplicateAgentUseCase', () => {
		let mockRepository: IAgentRepository;
		let duplicateAgentUseCase: DuplicateAgentUseCase;

		beforeEach(() => {
			mockRepository = createMockRepository();
			duplicateAgentUseCase = new DuplicateAgentUseCase(mockRepository);
			vi.clearAllMocks();
		});

		it('should duplicate agent with new slug', async () => {
			const sourceAgent = createMockAgent({
				id: 'source-agent',
				name: 'Source Agent',
				slug: 'source-agent',
				description: 'Source description',
				mode: 'primary',
				model: 'gpt-4',
				temperature: '0.7',
				tools: { tool1: true },
				content: 'Source content',
				subagents: [],
			});

			const duplicatedAgent = createMockAgent({
				id: 'duplicated-agent',
				name: 'Source Agent (copia)',
				slug: 'source-agent-copy',
				description: 'Source description',
				mode: 'primary',
				model: 'gpt-4',
				temperature: '0.7',
				tools: { tool1: true },
				content: 'Source content',
				subagents: [],
			});

			vi.mocked(mockRepository.findById).mockResolvedValue(sourceAgent);
			vi.mocked(mockRepository.findBySlug).mockResolvedValue(undefined);
			vi.mocked(mockRepository.create).mockResolvedValue(duplicatedAgent);

			const result = await duplicateAgentUseCase.execute('source-agent');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.slug).toBe('source-agent-copy');
				expect(result.data.name).toBe('Source Agent (copia)');
			}
			expect(mockRepository.findById).toHaveBeenCalledWith('source-agent');
			expect(mockRepository.findBySlug).toHaveBeenCalledWith('source-agent-copy');
			expect(mockRepository.create).toHaveBeenCalled();
		});

		it('should generate unique slug with suffix when copy slug exists', async () => {
			const sourceAgent = createMockAgent({
				id: 'source-agent',
				name: 'My Agent',
				slug: 'my-agent',
				subagents: [],
			});

			const existingCopy = createMockAgent({
				id: 'existing-copy',
				slug: 'my-agent-copy',
			});

			const newDuplicatedAgent = createMockAgent({
				id: 'new-duplicate',
				name: 'My Agent (copia)',
				slug: 'my-agent-copy-2',
				subagents: [],
			});

			vi.mocked(mockRepository.findById).mockResolvedValue(sourceAgent);
			vi.mocked(mockRepository.findBySlug)
				.mockResolvedValueOnce(existingCopy) // First call: my-agent-copy exists
				.mockResolvedValueOnce(undefined); // Second call: my-agent-copy-2 doesn't exist
			vi.mocked(mockRepository.create).mockResolvedValue(newDuplicatedAgent);

			const result = await duplicateAgentUseCase.execute('source-agent');

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.slug).toBe('my-agent-copy-2');
			}
			expect(mockRepository.findBySlug).toHaveBeenCalledTimes(2);
		});

		it('should return error when source agent not found', async () => {
			vi.mocked(mockRepository.findById).mockResolvedValue(undefined);

			const result = await duplicateAgentUseCase.execute('non-existent-id');

			expect(result).toEqual({
				success: false,
				error: 'Agent not found',
			});
		});

		it('should handle repository errors', async () => {
			vi.mocked(mockRepository.findById).mockRejectedValue(new Error('Database error'));

			const result = await duplicateAgentUseCase.execute('source-agent');

			expect(result).toEqual({
				success: false,
				error: 'Error al duplicar agente: Database error',
			});
		});
	});
});