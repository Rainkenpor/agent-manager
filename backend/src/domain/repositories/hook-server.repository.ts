import type {
	HookServerEntity,
	CreateHookServerDTO,
	UpdateHookServerDTO,
	HookAssignmentEntity,
	CreateHookAssignmentDTO
} from '../entities/hook-server.entity.js'

export interface IHookServerRepository {
	findAll(): Promise<HookServerEntity[]>
	findById(id: string): Promise<HookServerEntity | null>
	create(data: CreateHookServerDTO): Promise<HookServerEntity>
	update(id: string, data: UpdateHookServerDTO): Promise<HookServerEntity>
	delete(id: string): Promise<void>

	// Assignments
	getAssignments(hookServerId: string, hookName?: string): Promise<HookAssignmentEntity[]>
	createAssignment(data: CreateHookAssignmentDTO): Promise<HookAssignmentEntity>
	deleteAssignment(assignmentId: string): Promise<void>
}
