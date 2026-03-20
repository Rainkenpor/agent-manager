import { eq, and } from "drizzle-orm";
import { db } from "@infra/db/database.js";
import {
	roles,
	rolePermissions,
	permissions,
	type Role as DbRole,
	type NewRole,
} from "@infra/db/schema.js";
import type { IRoleRepository } from "@domain/repositories/role.repository.js";
import type {
	Role,
	CreateRole,
	UpdateRole,
} from "@domain/entities/role.entity.js";
import { randomUUID } from "crypto";

export class RoleRepository implements IRoleRepository {
	async create(data: CreateRole): Promise<Role> {
		const newRole: NewRole = {
			id: randomUUID(),
			name: data.name,
			description: data.description,
			active: true,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		const [created] = await db.insert(roles).values(newRole).returning();
		return this.mapToEntity(created);
	}

	async findById(id: string): Promise<Role | null> {
		const [role] = await db.select().from(roles).where(eq(roles.id, id));
		return role ? this.mapToEntity(role) : null;
	}

	async findByName(name: string): Promise<Role | null> {
		const [role] = await db.select().from(roles).where(eq(roles.name, name));
		return role ? this.mapToEntity(role) : null;
	}

	async findAll(filters?: { active?: boolean }): Promise<Role[]> {
		let query = db.select().from(roles);

		if (filters?.active !== undefined) {
			query = query.where(eq(roles.active, filters.active));
		}

		const results = await query;
		return results.map((role) => this.mapToEntity(role));
	}

	async update(id: string, data: UpdateRole): Promise<Role> {
		const updateData: Partial<NewRole> = {
			...data,
			updatedAt: new Date().toISOString(),
		};

		const [updated] = await db
			.update(roles)
			.set(updateData)
			.where(eq(roles.id, id))
			.returning();

		return this.mapToEntity(updated);
	}

	async delete(id: string): Promise<void> {
		await db.delete(roles).where(eq(roles.id, id));
	}

	// Gestión de permisos
	async assignPermission(roleId: string, permissionId: string): Promise<void> {
		await db.insert(rolePermissions).values({
			id: randomUUID(),
			roleId,
			permissionId,
			assignedAt: new Date().toISOString(),
		});
	}

	async removePermission(roleId: string, permissionId: string): Promise<void> {
		await db
			.delete(rolePermissions)
			.where(
				and(
					eq(rolePermissions.roleId, roleId),
					eq(rolePermissions.permissionId, permissionId),
				),
			);
	}

	async getPermissions(
		roleId: string,
	): Promise<Array<{ id: string; resource: string; action: string }>> {
		const results = await db
			.select({
				id: permissions.id,
				resource: permissions.resource,
				action: permissions.action,
			})
			.from(rolePermissions)
			.innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
			.where(eq(rolePermissions.roleId, roleId));

		return results;
	}

	private mapToEntity(dbRole: DbRole): Role {
		return {
			id: dbRole.id,
			name: dbRole.name,
			description: dbRole.description ?? undefined,
			active: dbRole.active,
			createdAt: dbRole.createdAt,
			updatedAt: dbRole.updatedAt,
		};
	}
}
