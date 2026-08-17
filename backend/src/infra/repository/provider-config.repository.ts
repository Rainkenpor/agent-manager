import { AppDataSource } from '@infra/db/database.js'
import { ProviderConfigEntity } from '@infra/db/entities.js'
import { v4 as uuidv4 } from 'uuid'
import type {
	ProviderConfig,
	ProviderName,
	ProviderPayload,
	ProviderSampling,
	ProviderType,
	UpsertProviderConfigDTO
} from '../../domain/entities/provider-config.entity.js'
import { normalizeSampling } from '../../domain/entities/provider-config.entity.js'
import type { IProviderConfigRepository } from '../../domain/repositories/provider-config.repository.js'
import { envs } from '../../envs.js'
import { decrypt, encrypt } from '../service/crypto.service.js'

function parsePayload(raw: string): ProviderPayload {
	const decrypted = decrypt(raw, envs.CREDENTIAL_ENCRYPTION_KEY)
	return JSON.parse(decrypted) as ProviderPayload
}

function toDomain(entity: ProviderConfigEntity): ProviderConfig {
	let payload: ProviderPayload
	try {
		payload = parsePayload(entity.payload)
	} catch {
		payload = JSON.parse(entity.payload) as ProviderPayload
	}

	return {
		id: entity.id,
		provider: entity.provider as ProviderName,
		label: entity.label ?? entity.provider,
		type: (entity.type as ProviderType) ?? 'codex',
		isActive: Boolean(entity.isActive),
		payload,
		sampling: entity.sampling ? normalizeSampling(entity.sampling as Partial<ProviderSampling>) : null,
		expiresAt: entity.expiresAt,
		lastValidatedAt: entity.lastValidatedAt,
		createdAt: entity.createdAt,
		updatedAt: entity.updatedAt
	}
}

export class ProviderConfigRepository implements IProviderConfigRepository {
	private get repo() {
		return AppDataSource.getRepository(ProviderConfigEntity)
	}

	async findAll(): Promise<ProviderConfig[]> {
		const rows = await this.repo.find({ order: { createdAt: 'ASC' } })
		return rows.map(toDomain)
	}

	async findByProvider(provider: ProviderName): Promise<ProviderConfig | null> {
		const row = await this.repo.findOneBy({ provider })
		return row ? toDomain(row) : null
	}

	async findActive(): Promise<ProviderConfig | null> {
		const row = await this.repo.findOneBy({ isActive: true })
		return row ? toDomain(row) : null
	}

	async upsert(data: UpsertProviderConfigDTO): Promise<ProviderConfig> {
		const existing = await this.repo.findOneBy({ provider: data.provider })
		const now = new Date().toISOString()
		const encryptedPayload = encrypt(JSON.stringify(data.payload), envs.CREDENTIAL_ENCRYPTION_KEY)

		if (existing) {
			await this.repo.update(existing.id, {
				payload: encryptedPayload,
				...(data.label !== undefined ? { label: data.label } : {}),
				...(data.type !== undefined ? { type: data.type } : {}),
				...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
				...(data.sampling !== undefined ? { sampling: data.sampling as unknown as Record<string, unknown> } : {}),
				expiresAt: data.expiresAt ?? null,
				lastValidatedAt: data.lastValidatedAt ?? null,
				updatedAt: now
			})
			const updated = await this.repo.findOneByOrFail({ id: existing.id })
			return toDomain(updated)
		}

		const entity = this.repo.create({
			id: uuidv4(),
			provider: data.provider,
			label: data.label ?? data.provider,
			type: data.type ?? 'codex',
			isActive: data.isActive ?? false,
			payload: encryptedPayload,
			sampling: (data.sampling ?? null) as unknown as Record<string, unknown> | null,
			expiresAt: data.expiresAt ?? null,
			lastValidatedAt: data.lastValidatedAt ?? null,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return toDomain(entity)
	}

	async setActive(provider: ProviderName): Promise<void> {
		await this.repo.update({ isActive: true }, { isActive: false })
		await this.repo.update({ provider }, { isActive: true, updatedAt: new Date().toISOString() })
	}

	async updateValidation(provider: ProviderName, lastValidatedAt: string): Promise<void> {
		await this.repo.update({ provider }, { lastValidatedAt, updatedAt: lastValidatedAt })
	}

	async delete(provider: ProviderName): Promise<void> {
		await this.repo.delete({ provider })
	}
}
