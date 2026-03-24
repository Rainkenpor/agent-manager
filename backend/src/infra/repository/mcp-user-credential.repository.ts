import { db } from '../db/database.js'
import { mcpServers, mcpUserCredentials } from '../db/schema.js'
import { and, eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { encrypt, decrypt } from '../service/crypto.service.js'
import { envs } from '../../envs.js'
import type { IMcpUserCredentialRepository } from '../../domain/repositories/mcp-user-credential.repository.js'
import type { McpUserCredential, UpsertMcpCredentialDTO } from '../../domain/entities/mcp-user-credential.entity.js'

function decryptRow(row: typeof mcpUserCredentials.$inferSelect): McpUserCredential {
	let value = row.value
	try {
		value = decrypt(row.value, envs.CREDENTIAL_ENCRYPTION_KEY)
	} catch {
		// value stored in plaintext (legacy row) — return as-is
	}
	return { ...row, value } as McpUserCredential
}

export class McpUserCredentialRepository implements IMcpUserCredentialRepository {
	async findByUserAndMcp(userId: string, mcpServerId: string, showValue?: boolean): Promise<McpUserCredential[]> {
		const mcpServer = await db.select().from(mcpServers).where(eq(mcpServers.name, mcpServerId)).limit(1)
		if (mcpServer.length > 0) {
			mcpServerId = mcpServer[0].id
		}
		const rows = await db
			.select()
			.from(mcpUserCredentials)
			.where(and(eq(mcpUserCredentials.userId, userId), eq(mcpUserCredentials.mcpServerId, mcpServerId)))
		if (showValue) {
			return rows.map(decryptRow)
		}
		return rows.map((row) => ({ ...row, value: '*****' }) as McpUserCredential)
	}

	async findByUser(userId: string): Promise<McpUserCredential[]> {
		const rows = await db.select().from(mcpUserCredentials).where(eq(mcpUserCredentials.userId, userId))
		return rows.map(decryptRow)
	}

	async upsert(data: UpsertMcpCredentialDTO): Promise<McpUserCredential> {
		const encryptedValue = encrypt(data.value, envs.CREDENTIAL_ENCRYPTION_KEY)

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
			await db.update(mcpUserCredentials).set({ value: encryptedValue, updatedAt: now }).where(eq(mcpUserCredentials.id, existing[0].id))
			// Return with decrypted value
			return { ...existing[0], value: data.value, updatedAt: now } as McpUserCredential
		}

		const id = uuidv4()
		await db.insert(mcpUserCredentials).values({ id, ...data, value: encryptedValue, createdAt: now, updatedAt: now })
		// Return with decrypted value
		return { id, ...data, value: data.value, createdAt: now, updatedAt: now }
	}

	async delete(userId: string, mcpServerId: string, key: string): Promise<void> {
		await db
			.delete(mcpUserCredentials)
			.where(and(eq(mcpUserCredentials.userId, userId), eq(mcpUserCredentials.mcpServerId, mcpServerId), eq(mcpUserCredentials.key, key)))
	}
}
