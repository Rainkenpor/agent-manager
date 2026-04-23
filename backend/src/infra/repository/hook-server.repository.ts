import { AppDataSource } from '@infra/db/database.js'
import { HookServerEntity, HookAssignmentEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type { IHookServerRepository } from '../../domain/repositories/hook-server.repository.js'
import type {
	HookServerEntity as HookServerDomain,
	CreateHookServerDTO,
	UpdateHookServerDTO,
	HookAssignmentEntity as HookAssignmentDomain,
	CreateHookAssignmentDTO
} from '../../domain/entities/hook-server.entity.js'

export class HookServerRepository implements IHookServerRepository {
	private get serverRepo() {
		return AppDataSource.getRepository(HookServerEntity)
	}

	private get assignmentRepo() {
		return AppDataSource.getRepository(HookAssignmentEntity)
	}

	async findAll(): Promise<HookServerDomain[]> {
		const rows = await this.serverRepo.find()
		return rows.map(this.mapServer)
	}

	async findById(id: string): Promise<HookServerDomain | null> {
		const row = await this.serverRepo.findOneBy({ id })
		return row ? this.mapServer(row) : null
	}

	async create(data: CreateHookServerDTO): Promise<HookServerDomain> {
		const now = new Date().toISOString()
		const entity = this.serverRepo.create({
			id: uuidv4(),
			name: data.name,
			displayName: data.displayName ?? null,
			description: data.description ?? null,
			url: data.url,
			active: data.active ?? true,
			createdAt: now,
			updatedAt: now
		})
		await this.serverRepo.save(entity)
		return (await this.findById(entity.id))!
	}

	async update(id: string, data: UpdateHookServerDTO): Promise<HookServerDomain> {
		const updateData: Partial<HookServerEntity> = { updatedAt: new Date().toISOString() }
		if (data.displayName !== undefined) updateData.displayName = data.displayName
		if (data.description !== undefined) updateData.description = data.description
		if (data.url !== undefined) updateData.url = data.url
		if (data.active !== undefined) updateData.active = data.active
		await this.serverRepo.update(id, updateData)
		return (await this.findById(id))!
	}

	async delete(id: string): Promise<void> {
		await this.serverRepo.delete(id)
	}

	async getAssignments(hookServerId: string, hookName?: string): Promise<HookAssignmentDomain[]> {
		const where: Record<string, string> = { hookServerId }
		if (hookName) where.hookName = hookName
		const rows = await this.assignmentRepo.findBy(where as any)
		return rows.map(this.mapAssignment)
	}

	async createAssignment(data: CreateHookAssignmentDTO): Promise<HookAssignmentDomain> {
		const entity = this.assignmentRepo.create({
			id: uuidv4(),
			hookServerId: data.hookServerId,
			hookName: data.hookName,
			assignmentType: data.assignmentType,
			assignmentId: data.assignmentId,
			assignmentName: data.assignmentName,
			extraData: data.extraData ?? null,
			createdAt: new Date().toISOString()
		})
		await this.assignmentRepo.save(entity)
		return this.mapAssignment((await this.assignmentRepo.findOneByOrFail({ id: entity.id })))
	}

	async deleteAssignment(assignmentId: string): Promise<void> {
		await this.assignmentRepo.delete(assignmentId)
	}

	private mapServer(e: HookServerEntity): HookServerDomain {
		return {
			id: e.id,
			name: e.name,
			displayName: e.displayName,
			description: e.description,
			url: e.url,
			active: e.active,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt
		}
	}

	private mapAssignment(e: HookAssignmentEntity): HookAssignmentDomain {
		return {
			id: e.id,
			hookServerId: e.hookServerId,
			hookName: e.hookName,
			assignmentType: e.assignmentType as 'agent' | 'mcp_tool',
			assignmentId: e.assignmentId,
			assignmentName: e.assignmentName,
			extraData: e.extraData,
			createdAt: e.createdAt
		}
	}
}
