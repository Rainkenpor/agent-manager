import { eq, and } from "drizzle-orm";
import { db } from "@infra/db/database.js";
import {
	users,
	userRoles,
	rolePermissions,
	roles,
	permissions,
	type User as DbUser,
	type NewUser,
} from "@infra/db/schema.js";
import type { IUserRepository } from "@domain/repositories/user.repository.js";
import type {
	User,
	CreateUser,
	UpdateUser,
} from "@domain/entities/user.entity.js";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { getSocketService } from "@infra/service/socket.service.js";

export class UserRepository implements IUserRepository {
	async create(data: CreateUser): Promise<User> {
		const hashedPassword = await bcrypt.hash(data.password, 10);

		const newUser: NewUser = {
			id: randomUUID(),
			email: data.email,
			username: data.username,
			password: hashedPassword,
			firstName: data.firstName,
			lastName: data.lastName,
			active: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const [created] = await db.insert(users).values(newUser).returning();
		return this.mapToEntity(created);
	}

	async findById(id: string): Promise<User | null> {
		const [user] = await db.select().from(users).where(eq(users.id, id));
		return user ? this.mapToEntity(user) : null;
	}

	async findByEmail(email: string): Promise<User | null> {
		const [user] = await db.select().from(users).where(eq(users.email, email));
		return user ? this.mapToEntity(user) : null;
	}

	async findByUsername(username: string): Promise<User | null> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.username, username));
		return user ? this.mapToEntity(user) : null;
	}

	async findAll(filters?: {
		active?: boolean;
	}): Promise<(User & { isActive: boolean; isConnectedToSocket: boolean })[]> {
		const results = await (filters?.active !== undefined
			? db.select().from(users).where(eq(users.active, filters.active))
			: db.select().from(users));

		// Obtener estado de conexión de socket para todos los usuarios
		const userIds = results.map((user) => user.id);
		let socketStatus = new Map<string, boolean>();

		try {
			const socketService = getSocketService();
			socketStatus = await socketService.getUsersConnectionStatus(userIds);
		} catch {
			// Socket service no está inicializado aún o falló
			// Asignar todos como no conectados
			for (const id of userIds) {
				socketStatus.set(id, false);
			}
		}

		const usersWithStatus = results.map((user) => ({
			...this.mapToEntity(user),
			isActive: user.active,
			isConnectedToSocket: socketStatus.get(user.id) || false,
		}));

		return usersWithStatus;
	}

	async update(id: string, data: UpdateUser): Promise<User> {
		const updateData: Partial<NewUser> = {
			...data,
			updatedAt: new Date().toISOString(),
		};

		if (data.password) {
			updateData.password = await bcrypt.hash(data.password, 10);
		}

		const [updated] = await db
			.update(users)
			.set(updateData)
			.where(eq(users.id, id))
			.returning();

		return this.mapToEntity(updated);
	}

	async delete(id: string): Promise<void> {
		await db.delete(users).where(eq(users.id, id));
	}

	async updateLastLogin(id: string): Promise<void> {
		await db
			.update(users)
			.set({ lastLoginAt: new Date().toISOString() })
			.where(eq(users.id, id));
	}

	// Gestión de roles
	async assignRole(userId: string, roleId: string): Promise<void> {
		await db.insert(userRoles).values({
			id: randomUUID(),
			userId,
			roleId,
			assignedAt: new Date().toISOString(),
		});
	}

	async removeRole(userId: string, roleId: string): Promise<void> {
		await db
			.delete(userRoles)
			.where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
	}

	async getRoles(userId: string): Promise<Array<{ id: string; name: string }>> {
		const results = await db
			.select({
				id: roles.id,
				name: roles.name,
			})
			.from(userRoles)
			.innerJoin(roles, eq(userRoles.roleId, roles.id))
			.where(eq(userRoles.userId, userId));

		return results;
	}

	// Verificación de permisos
	async hasPermission(
		userId: string,
		resource: string,
		action: string,
	): Promise<boolean> {
		const result = await db
			.select({ id: permissions.id })
			.from(userRoles)
			.innerJoin(roles, eq(userRoles.roleId, roles.id))
			.innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(
				and(
					eq(userRoles.userId, userId),
					eq(permissions.resource, resource),
					eq(permissions.action, action),
					eq(roles.active, true),
				),
			)
			.limit(1);

		return result.length > 0;
	}

	async getPermissions(
		userId: string,
	): Promise<Array<{ resource: string; action: string }>> {
		const results = await db
			.select({
				resource: permissions.resource,
				action: permissions.action,
			})
			.from(userRoles)
			.innerJoin(roles, eq(userRoles.roleId, roles.id))
			.innerJoin(rolePermissions, eq(roles.id, rolePermissions.roleId))
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(and(eq(userRoles.userId, userId), eq(roles.active, true)));

		return results;
	}

	private mapToEntity(dbUser: DbUser): User {
		return {
			id: dbUser.id,
			email: dbUser.email,
			username: dbUser.username,
			password: dbUser.password,
			firstName: dbUser.firstName ?? undefined,
			lastName: dbUser.lastName ?? undefined,
			active: dbUser.active,
			createdAt: dbUser.createdAt,
			updatedAt: dbUser.updatedAt,
			lastLoginAt: dbUser.lastLoginAt ?? undefined,
		};
	}
}
