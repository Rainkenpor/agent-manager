import { db } from '@infra/db/database.js'
import { mcpServers, roleMcps, roleAgents, roleMcpTools, agents } from '@infra/db/schema.js'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { IMcpServerRepository } from '@domain/repositories/mcp-server.repository.js'
import type { McpServerEntity, CreateMcpServer, UpdateMcpServer } from '@domain/entities/mcp-server.entity.js'

export class McpServerRepository implements IMcpServerRepository {
	private mapToEntity(row: typeof mcpServers.$inferSelect): McpServerEntity {
		return {
			id: row.id,
			name: row.name,
			displayName: row.displayName,
			description: row.description,
			type: row.type,
			url: row.url,
			command: row.command,
			args: row.args ?? [],
			headers: row.headers ?? {},
			credentialFields: row.credentialFields ?? [],
			active: row.active,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}
	}

	async create(data: CreateMcpServer): Promise<McpServerEntity> {
		const id = uuidv4()
		const now = new Date().toISOString()
		await db.insert(mcpServers).values({
			id,
			name: data.name,
			displayName: data.displayName ?? null,
			description: data.description ?? null,
			type: data.type ?? 'http',
			url: data.url ?? null,
			command: data.command ?? null,
			args: data.args ?? [],
			headers: data.headers ?? {},
			credentialFields: data.credentialFields ?? [],
			active: data.active ?? true,
			createdAt: now,
			updatedAt: now
		})
		return this.mapToEntity((await db.select().from(mcpServers).where(eq(mcpServers.id, id)))[0])
	}

	async findAll(): Promise<McpServerEntity[]> {
		const rows = await db.select().from(mcpServers)

		// Ordenar primero local y luego por nombre
		rows.sort((a, b) => {
			if (a.type === 'local') return -1
			if (b.type === 'local') return 1
			return a.name.localeCompare(b.name)
		})

		return rows.map(this.mapToEntity)
	}

	async findById(id: string): Promise<McpServerEntity | null> {
		const rows = await db.select().from(mcpServers).where(eq(mcpServers.id, id))
		return rows[0] ? this.mapToEntity(rows[0]) : null
	}

	async findByName(name: string): Promise<McpServerEntity | null> {
		const rows = await db.select().from(mcpServers).where(eq(mcpServers.name, name))
		return rows[0] ? this.mapToEntity(rows[0]) : null
	}

	async update(id: string, data: UpdateMcpServer): Promise<McpServerEntity> {
		await db
			.update(mcpServers)
			.set({ ...data, updatedAt: new Date().toISOString() })
			.where(eq(mcpServers.id, id))
		return this.mapToEntity((await db.select().from(mcpServers).where(eq(mcpServers.id, id)))[0])
	}

	async delete(id: string): Promise<void> {
		await db.delete(mcpServers).where(eq(mcpServers.id, id))
	}

	async assignToRole(roleId: string, mcpServerId: string): Promise<void> {
		const existing = await db.select().from(roleMcps).where(eq(roleMcps.roleId, roleId))
		const alreadyAssigned = existing.some((r) => r.mcpServerId === mcpServerId)
		if (alreadyAssigned) return
		await db.insert(roleMcps).values({
			id: uuidv4(),
			roleId,
			mcpServerId,
			assignedAt: new Date().toISOString()
		})
	}

	async removeFromRole(roleId: string, mcpServerId: string): Promise<void> {
		const allForRole = await db.select().from(roleMcps).where(eq(roleMcps.roleId, roleId))
		const entry = allForRole.find((r) => r.mcpServerId === mcpServerId)
		if (entry) {
			await db.delete(roleMcps).where(eq(roleMcps.id, entry.id))
		}
	}

	async getByRole(roleId: string): Promise<McpServerEntity[]> {
		const relations = await db.select().from(roleMcps).where(eq(roleMcps.roleId, roleId))
		if (!relations.length) return []
		const results: McpServerEntity[] = []
		for (const rel of relations) {
			const rows = await db.select().from(mcpServers).where(eq(mcpServers.id, rel.mcpServerId))
			if (rows[0]) results.push(this.mapToEntity(rows[0]))
		}
		return results
	}

	async assignAgentToRole(roleId: string, agentId: string): Promise<void> {
		const existing = await db.select().from(roleAgents).where(eq(roleAgents.roleId, roleId))
		const alreadyAssigned = existing.some((r) => r.agentId === agentId)
		if (alreadyAssigned) return
		await db.insert(roleAgents).values({
			id: uuidv4(),
			roleId,
			agentId,
			assignedAt: new Date().toISOString()
		})
	}

	async removeAgentFromRole(roleId: string, agentId: string): Promise<void> {
		const allForRole = await db.select().from(roleAgents).where(eq(roleAgents.roleId, roleId))
		const entry = allForRole.find((r) => r.agentId === agentId)
		if (entry) {
			await db.delete(roleAgents).where(eq(roleAgents.id, entry.id))
		}
	}

	async getAgentsByRole(roleId: string): Promise<Array<{ id: string; name: string; slug: string; mode: string }>> {
		const relations = await db.select().from(roleAgents).where(eq(roleAgents.roleId, roleId))
		if (!relations.length) return []
		const results: Array<{ id: string; name: string; slug: string; mode: string }> = []
		for (const rel of relations) {
			const rows = await db.select().from(agents).where(eq(agents.id, rel.agentId))
			if (rows[0]) {
				results.push({ id: rows[0].id, name: rows[0].name, slug: rows[0].slug, mode: rows[0].mode })
			}
		}
		return results
	}

	async getRoleMcpTools(roleId: string, mcpServerId: string): Promise<string[]> {
		const rows = await db
			.select()
			.from(roleMcpTools)
			.where(and(eq(roleMcpTools.roleId, roleId), eq(roleMcpTools.mcpServerId, mcpServerId)))
		return rows.map((r) => r.toolName)
	}

	async setRoleMcpTools(roleId: string, mcpServerId: string, toolNames: string[]): Promise<void> {
		// Delete existing selections for this role+server
		await db.delete(roleMcpTools).where(and(eq(roleMcpTools.roleId, roleId), eq(roleMcpTools.mcpServerId, mcpServerId)))
		// Insert new selections
		if (toolNames.length > 0) {
			await db.insert(roleMcpTools).values(
				toolNames.map((toolName) => ({
					id: uuidv4(),
					roleId,
					mcpServerId,
					toolName,
					assignedAt: new Date().toISOString()
				}))
			)
		}
	}
}
