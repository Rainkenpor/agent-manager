import { AppDataSource } from '@infra/db/database.js'
import { PermissionEntity } from '@infra/db/entities.js'
import type { IPermissionRepository } from '@domain/repositories/permission.repository.js'
import type { Permission, CreatePermission } from '@domain/entities/permission.entity.js'
import { randomUUID } from 'crypto'

export class PermissionRepository implements IPermissionRepository {
	private get repo() {
		return AppDataSource.getRepository(PermissionEntity)
	}

	async create(data: CreatePermission): Promise<Permission> {
		const entity = this.repo.create({
			id: randomUUID(),
			resource: data.resource,
			action: data.action,
			description: data.description ?? null,
			createdAt: new Date().toISOString()
		})
		const saved = await this.repo.save(entity)
		return this.mapToEntity(saved)
	}

	async findById(id: string): Promise<Permission | null> {
		const p = await this.repo.findOneBy({ id })
		return p ? this.mapToEntity(p) : null
	}

	async findByResourceAndAction(resource: string, action: string): Promise<Permission | null> {
		const p = await this.repo.findOneBy({ resource, action })
		return p ? this.mapToEntity(p) : null
	}

	async findAll(): Promise<Permission[]> {
		const results = await this.repo.find()
		return results.map((p) => this.mapToEntity(p))
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	private mapToEntity(e: PermissionEntity): Permission {
		return {
			id: e.id,
			resource: e.resource,
			action: e.action,
			description: e.description ?? undefined,
			createdAt: e.createdAt
		}
	}
}
