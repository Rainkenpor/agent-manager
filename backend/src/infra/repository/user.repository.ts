import { AppDataSource } from '@infra/db/database.js'
import {
	UserEntity,
	UserRoleEntity,
	RoleEntity,
	RolePermissionEntity,
	PermissionEntity
} from '@infra/db/entities.js'
import type { IUserRepository } from '@domain/repositories/user.repository.js'
import type { User, CreateUser, UpdateUser } from '@domain/entities/user.entity.js'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'

export class UserRepository implements IUserRepository {
	private get repo() {
		return AppDataSource.getRepository(UserEntity)
	}

	async create(data: CreateUser): Promise<User> {
		const hashedPassword = await bcrypt.hash(data.password, 10)
		const now = new Date().toISOString()
		const entity = this.repo.create({
			id: randomUUID(),
			email: data.email,
			username: data.username,
			password: hashedPassword,
			firstName: data.firstName ?? null,
			lastName: data.lastName ?? null,
			active: true,
			createdAt: now,
			updatedAt: now,
			lastLoginAt: null
		})
		const saved = await this.repo.save(entity)
		return this.mapToEntity(saved)
	}

	async findById(id: string): Promise<User | null> {
		const user = await this.repo.findOneBy({ id })
		return user ? this.mapToEntity(user) : null
	}

	async findByEmail(email: string): Promise<User | null> {
		const user = await this.repo.findOneBy({ email })
		return user ? this.mapToEntity(user) : null
	}

	async findByUsername(username: string): Promise<User | null> {
		const user = await this.repo.findOneBy({ username })
		return user ? this.mapToEntity(user) : null
	}

	async findAll(filters?: { active?: boolean }): Promise<(User & { isActive: boolean })[]> {
		const where = filters?.active !== undefined ? { active: filters.active } : {}
		const results = await this.repo.findBy(where)
		return results.map((user) => ({
			...this.mapToEntity(user),
			isActive: user.active
		}))
	}

	async update(id: string, data: UpdateUser): Promise<User> {
		const updateData: Partial<UserEntity> = {
			...data,
			updatedAt: new Date().toISOString()
		}
		if (data.password) {
			updateData.password = await bcrypt.hash(data.password, 10)
		}
		await this.repo.update(id, updateData)
		const updated = await this.repo.findOneByOrFail({ id })
		return this.mapToEntity(updated)
	}

	async delete(id: string): Promise<void> {
		await this.repo.delete(id)
	}

	async updateLastLogin(id: string): Promise<void> {
		await this.repo.update(id, { lastLoginAt: new Date().toISOString() })
	}

	async assignRole(userId: string, roleId: string): Promise<void> {
		const repo = AppDataSource.getRepository(UserRoleEntity)
		const entry = repo.create({
			id: randomUUID(),
			userId,
			roleId,
			assignedAt: new Date().toISOString()
		})
		await repo.save(entry)
	}

	async removeRole(userId: string, roleId: string): Promise<void> {
		const repo = AppDataSource.getRepository(UserRoleEntity)
		await repo.delete({ userId, roleId })
	}

	async getRoles(userId: string): Promise<Array<{ id: string; name: string }>> {
		const results = await AppDataSource.createQueryBuilder(UserRoleEntity, 'ur')
			.innerJoin(RoleEntity, 'r', 'ur.role_id = r.id')
			.select(['r.id AS id', 'r.name AS name'])
			.where('ur.user_id = :userId', { userId })
			.getRawMany()
		return results.map((r) => ({ id: r.id, name: r.name }))
	}

	async hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
		const result = await AppDataSource.createQueryBuilder(UserRoleEntity, 'ur')
			.innerJoin(RoleEntity, 'r', 'ur.role_id = r.id')
			.innerJoin(RolePermissionEntity, 'rp', 'r.id = rp.role_id')
			.innerJoin(PermissionEntity, 'p', 'rp.permission_id = p.id')
			.where('ur.user_id = :userId', { userId })
			.andWhere('p.resource = :resource', { resource })
			.andWhere('p.action = :action', { action })
			.andWhere('r.active = :active', { active: true })
			.limit(1)
			.getCount()
		return result > 0
	}

	async getPermissions(userId: string): Promise<Array<{ resource: string; action: string }>> {
		const results = await AppDataSource.createQueryBuilder(UserRoleEntity, 'ur')
			.innerJoin(RoleEntity, 'r', 'ur.role_id = r.id')
			.innerJoin(RolePermissionEntity, 'rp', 'r.id = rp.role_id')
			.innerJoin(PermissionEntity, 'p', 'rp.permission_id = p.id')
			.select(['p.resource AS resource', 'p.action AS action'])
			.where('ur.user_id = :userId', { userId })
			.andWhere('r.active = :active', { active: true })
			.getRawMany()
		return results.map((r) => ({ resource: r.resource, action: r.action }))
	}

	private mapToEntity(e: UserEntity): User {
		return {
			id: e.id,
			email: e.email,
			username: e.username,
			password: e.password,
			firstName: e.firstName ?? undefined,
			lastName: e.lastName ?? undefined,
			active: e.active,
			createdAt: e.createdAt,
			updatedAt: e.updatedAt,
			lastLoginAt: e.lastLoginAt ?? undefined
		}
	}
}
