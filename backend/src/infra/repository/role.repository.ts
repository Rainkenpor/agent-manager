import { AppDataSource } from '@infra/db/database.js'
import { RoleEntity, RolePermissionEntity, PermissionEntity } from '@infra/db/entities.js'
import type { IRoleRepository } from '@domain/repositories/role.repository.js'
import type { Role, CreateRole, UpdateRole } from '@domain/entities/role.entity.js'
import { randomUUID } from 'crypto'

export class RoleRepository implements IRoleRepository {
	private get repo() {
		return AppDataSource.getRepository(RoleEntity)
	}

	async create(data: CreateRole): Promise<Role> {
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: randomUUID(),
			name: data.name,
			description: data.description ?? null,
			active: true,
			createdAt: now,
			updatedAt: now
		})
		const saved = await this.repo.save(entity)
		return this.mapToEntity(saved)
	}

	async findById(id: string): Promise<Role | null> {
		const role = await this.repo.findOneBy({ id })
		return role ? this.mapToEntity(role) : null
	}

	async findByName(name: string): Promise<Role | null> {
		const role = await this.repo.findOneBy({ name })
		return role ? this.mapToEntity(role) : null
	}

	async findAll(filters?: { active?: boolean }): Promise<Role[]> {
		const where = filters?.active !== undefined ? { active: filters.active } : {}
		const results = await this.repo.findBy(where)
		return results.map((r) => this.mapToEntity(r))
	}

	async update(id: string, data: UpdateRole): Promise<Role> {
		await this.repo.update(id, { ...data, updatedAt: new Date().toISOString() })
		const updated = await this.repo.findOneByOrFail({ id })
		return this.mapToEntity(updated)
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	async assignPermission(roleId: string, permissionId: string): Promise<void> {
		const repo = AppDataSource.getRepository(RolePermissionEntity)
		const entry = repo.create({
			id: randomUUID(),
			roleId,
			permissionId,
			assignedAt: new Date().toISOString()
		})
		await repo.save(entry)
	}

	async removePermission(roleId: string, permissionId: string): Promise<void> {
		const repo = AppDataSource.getRepository(RolePermissionEntity)
		await repo.delete({ roleId, permissionId })
	}

	async getPermissions(roleId: string): Promise<Array<{ id: string; resource: string; action: string }>> {
		const results = await AppDataSource.createQueryBuilder(RolePermissionEntity, 'rp')
			.innerJoin(PermissionEntity, 'p', 'rp.permission_id = p.id')
			.select(['p.id AS id', 'p.resource AS resource', 'p.action AS action'])
			.where('rp.role_id = :roleId', { roleId })
			.getRawMany()
		return results.map((r) => ({ id: r.id, resource: r.resource, action: r.action }))
	}

	private mapToEntity(e: RoleEntity): Role {
		return {
			id: e.id,
			name: e.name,
			description: e.description ?? undefined,
			active: e.active,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt
		}
	}
}
