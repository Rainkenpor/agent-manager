import { v4 as uuidv4 } from 'uuid'
import { AppDataSource } from '@infra/db/database.js'
import { ProviderConfigEntity } from '@infra/db/entities.js'
import { envs } from '../../envs.js'
import { decrypt, encrypt } from '../service/crypto.service.js'
import type {
	ProviderConfig,
	ProviderName,
	ProviderTokenPayload,
	UpsertProviderConfigDTO
} from '../../domain/entities/provider-config.entity.js'
import type { IProviderConfigRepository } from '../../domain/repositories/provider-config.repository.js'

function parsePayload(raw: string): ProviderTokenPayload {
	const decrypted = decrypt(raw, envs.CREDENTIAL_ENCRYPTION_KEY)
	return JSON.parse(decrypted) as ProviderTokenPayload
}

function toDomain(entity: ProviderConfigEntity): ProviderConfig {
	let payload: ProviderTokenPayload
	try {
		payload = parsePayload(entity.payload)
	} catch {
		payload = JSON.parse(entity.payload) as ProviderTokenPayload
	}

	return {
		id: entity.id,
		provider: entity.provider as ProviderName,
		payload,
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

	async findByProvider(provider: ProviderName): Promise<ProviderConfig | null> {
		const row = await this.repo.findOneBy({ provider })
		return row ? toDomain(row) : null
	}

	async upsert(data: UpsertProviderConfigDTO): Promise<ProviderConfig> {
		const existing = await this.repo.findOneBy({ provider: data.provider })
		const now = new Date().toISOString()
		const encryptedPayload = encrypt(JSON.stringify(data.payload), envs.CREDENTIAL_ENCRYPTION_KEY)

		if (existing) {
			await this.repo.update(existing.id, {
				payload: encryptedPayload,
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
			payload: encryptedPayload,
			expiresAt: data.expiresAt ?? null,
			lastValidatedAt: data.lastValidatedAt ?? null,
			createdAt: now,
			updatedAt: now
		})
		await this.repo.save(entity)
		return toDomain(entity)
	}

	async updateValidation(provider: ProviderName, lastValidatedAt: string): Promise<void> {
		await this.repo.update({ provider }, { lastValidatedAt, updatedAt: lastValidatedAt })
	}

	async delete(provider: ProviderName): Promise<void> {
		await this.repo.delete({ provider })
	}
}
