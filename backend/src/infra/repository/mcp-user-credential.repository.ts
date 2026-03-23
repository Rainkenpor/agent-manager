import { db } from '../db/database.js'
import { mcpUserCredentials } from '../db/schema.js'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import type { IMcpUserCredentialRepository } from '../../domain/repositories/mcp-user-credential.repository.js'
import type { McpUserCredential, UpsertMcpCredentialDTO } from '../../domain/entities/mcp-user-credential.entity.js'

export class McpUserCredentialRepository implements IMcpUserCredentialRepository {
	async findByUserAndMcp(userId: string, mcpServerId: string): Promise<McpUserCredential[]> {
		return db
			.select()
			.from(mcpUserCredentials)
			.where(and(eq(mcpUserCredentials.userId, userId), eq(mcpUserCredentials.mcpServerId, mcpServerId))) as Promise<McpUserCredential[]>
	}

	async findByUser(userId: string): Promise<McpUserCredential[]> {
		return db.select().from(mcpUserCredentials).where(eq(mcpUserCredentials.userId, userId)) as Promise<McpUserCredential[]>
	}

	async upsert(data: UpsertMcpCredentialDTO): Promise<McpUserCredential> {
		const existing = await db
			.select()
			.from(mcpUserCredentials)
			.where(
				and(
					eq(mcpUserCredentials.userId, data.userId),
					eq(mcpUserCredentials.mcpServerId, data.mcpServerId),
					eq(mcpUserCredentials.key, data.key)
				)
			)

		const now = new Date().toISOString()

		if (existing.length > 0) {
			await db
				.update(mcpUserCredentials)
				.set({ value: data.value, updatedAt: now })
				.where(eq(mcpUserCredentials.id, existing[0].id))
			return { ...existing[0], value: data.value, updatedAt: now } as McpUserCredential
		}

		const id = uuidv4()
		await db.insert(mcpUserCredentials).values({ id, ...data, createdAt: now, updatedAt: now })
		return { id, ...data, createdAt: now, updatedAt: now }
	}

	async delete(userId: string, mcpServerId: string, key: string): Promise<void> {
		await db
			.delete(mcpUserCredentials)
			.where(
				and(
					eq(mcpUserCredentials.userId, userId),
					eq(mcpUserCredentials.mcpServerId, mcpServerId),
					eq(mcpUserCredentials.key, key)
				)
			)
	}
}
