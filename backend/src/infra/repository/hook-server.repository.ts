import { db } from '../db/database.js'
import { hookServers, hookAssignments } from '../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { IHookServerRepository } from '../../domain/repositories/hook-server.repository.js'
import type {
	HookServerEntity,
	CreateHookServerDTO,
	UpdateHookServerDTO,
	HookAssignmentEntity,
	CreateHookAssignmentDTO
} from '../../domain/entities/hook-server.entity.js'

export class HookServerRepository implements IHookServerRepository {
	async findAll(): Promise<HookServerEntity[]> {
		const rows = await db.select().from(hookServers)
		return rows.map(this.mapServer)
	}

	async findById(id: string): Promise<HookServerEntity | null> {
		const rows = await db.select().from(hookServers).where(eq(hookServers.id, id))
		return rows[0] ? this.mapServer(rows[0]) : null
	}

	async create(data: CreateHookServerDTO): Promise<HookServerEntity> {
		const id = uuidv4()
		const now = new Date().toISOString()
		await db.insert(hookServers).values({
			id,
			name: data.name,
			displayName: data.displayName ?? null,
			description: data.description ?? null,
			url: data.url,
			active: data.active ?? true,
			createdAt: now,
			updatedAt: now
		})
		return (await this.findById(id))!
	}

	async update(id: string, data: UpdateHookServerDTO): Promise<HookServerEntity> {
		const now = new Date().toISOString()
		await db
			.update(hookServers)
			.set({
				...(data.displayName !== undefined && { displayName: data.displayName }),
				...(data.description !== undefined && { description: data.description }),
				...(data.url !== undefined && { url: data.url }),
				...(data.active !== undefined && { active: data.active }),
				updatedAt: now
			})
			.where(eq(hookServers.id, id))
		return (await this.findById(id))!
	}

	async delete(id: string): Promise<void> {
		await db.delete(hookServers).where(eq(hookServers.id, id))
	}

	async getAssignments(hookServerId: string, hookName?: string): Promise<HookAssignmentEntity[]> {
		const conditions = [eq(hookAssignments.hookServerId, hookServerId)]
		if (hookName) conditions.push(eq(hookAssignments.hookName, hookName))
		const rows = await db
			.select()
			.from(hookAssignments)
			.where(and(...conditions))
		return rows.map(this.mapAssignment)
	}

	async createAssignment(data: CreateHookAssignmentDTO): Promise<HookAssignmentEntity> {
		const id = uuidv4()
		const now = new Date().toISOString()
		await db.insert(hookAssignments).values({
			id,
			hookServerId: data.hookServerId,
			hookName: data.hookName,
			assignmentType: data.assignmentType,
			assignmentId: data.assignmentId,
			assignmentName: data.assignmentName,
			extraData: data.extraData ?? null,
			createdAt: now
		})
		const rows = await db.select().from(hookAssignments).where(eq(hookAssignments.id, id))
		return this.mapAssignment(rows[0])
	}

	async deleteAssignment(assignmentId: string): Promise<void> {
		await db.delete(hookAssignments).where(eq(hookAssignments.id, assignmentId))
	}

	private mapServer(row: typeof hookServers.$inferSelect): HookServerEntity {
		return {
			id: row.id,
			name: row.name,
			displayName: row.displayName,
			description: row.description,
			url: row.url,
			active: row.active,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	private mapAssignment(row: typeof hookAssignments.$inferSelect): HookAssignmentEntity {
		return {
			id: row.id,
			hookServerId: row.hookServerId,
			hookName: row.hookName,
			assignmentType: row.assignmentType as 'agent' | 'mcp_tool',
			assignmentId: row.assignmentId,
			assignmentName: row.assignmentName,
			extraData: row.extraData,
			createdAt: row.createdAt
		}
	}
}
