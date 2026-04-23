import { AppDataSource } from '@infra/db/database.js'
import { McpServerEntity, McpUserCredentialEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import { encrypt, decrypt } from '../service/crypto.service.js'
import { envs } from '../../envs.js'
import type { IMcpUserCredentialRepository } from '../../domain/repositories/mcp-user-credential.repository.js'
import type { McpUserCredential, UpsertMcpCredentialDTO } from '../../domain/entities/mcp-user-credential.entity.js'

function decryptRow(e: McpUserCredentialEntity): McpUserCredential {
	let value = e.value
	try {
		value = decrypt(e.value, envs.CREDENTIAL_ENCRYPTION_KEY)
	} catch {
		// legacy plaintext value — return as-is
	}
	return { ...e, value } as McpUserCredential
}

export class McpUserCredentialRepository implements IMcpUserCredentialRepository {
	private get repo() {
		return AppDataSource.getRepository(McpUserCredentialEntity)
	}

	async findByUserAndMcp(userId: string, mcpServerId: string, showValue?: boolean): Promise<McpUserCredential[]> {
		// Allow mcpServerId to be either an id or a name
		const serverRepo = AppDataSource.getRepository(McpServerEntity)
		const byName = await serverRepo.findOneBy({ name: mcpServerId })
		if (byName) mcpServerId = byName.id

		const rows = await this.repo.findBy({ userId, mcpServerId })
		if (showValue) {
			return rows.map(decryptRow)
		}
		return rows.map((row) => ({ ...row, value: '*****' }) as McpUserCredential)
	}

	async findByUser(userId: string): Promise<McpUserCredential[]> {
		const rows = await this.repo.findBy({ userId })
		return rows.map(decryptRow)
	}

	async upsert(data: UpsertMcpCredentialDTO): Promise<McpUserCredential> {
		const encryptedValue = encrypt(data.value, envs.CREDENTIAL_ENCRYPTION_KEY)
		const existing = await this.repo.findOneBy({
			userId: data.userId,
			mcpServerId: data.mcpServerId,
			key: data.key
		})
		const now = new Date().toISOString()

		if (existing) {
			await this.repo.update(existing.id, { value: encryptedValue, updatedAt: now })
			return { ...existing, value: data.value, updatedAt: now } as McpUserCredential
		}

		const id = uuidv4()
		const entity = this.repo.create({
			id,
			userId: data.userId,
			mcpServerId: data.mcpServerId,
			key: data.key,
			value: encryptedValue,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return { id, ...data, value: data.value, createdAt: now, updatedAt: now }
	}

	async delete(userId: string, mcpServerId: string, key: string): Promise<void> {
		await this.repo.delete({ userId, mcpServerId, key })
	}
}
