import { eq, and } from "drizzle-orm";
import { db } from "@infra/db/database.js";
import {
	permissions,
	type Permission as DbPermission,
	type NewPermission,
} from "@infra/db/schema.js";
import type { IPermissionRepository } from "@domain/repositories/permission.repository.js";
import type {
	Permission,
	CreatePermission,
} from "@domain/entities/permission.entity.js";
import { randomUUID } from "crypto";

export class PermissionRepository implements IPermissionRepository {
	async create(data: CreatePermission): Promise<Permission> {
		const newPermission: NewPermission = {
			id: randomUUID(),
			resource: data.resource,
			action: data.action,
			description: data.description,
			createdAt: new Date().toISOString(),
		};

		const [created] = await db
			.insert(permissions)
			.values(newPermission)
			.returning();
		return this.mapToEntity(created);
	}

	async findById(id: string): Promise<Permission | null> {
		const [permission] = await db
			.select()
			.from(permissions)
			.where(eq(permissions.id, id));
		return permission ? this.mapToEntity(permission) : null;
	}

	async findByResourceAndAction(
		resource: string,
		action: string,
	): Promise<Permission | null> {
		const [permission] = await db
			.select()
			.from(permissions)
			.where(
				and(eq(permissions.resource, resource), eq(permissions.action, action)),
			);
		return permission ? this.mapToEntity(permission) : null;
	}

	async findAll(): Promise<Permission[]> {
		const results = await db.select().from(permissions);
		return results.map((permission) => this.mapToEntity(permission));
	}

	async delete(id: string): Promise<void> {
		await db.delete(permissions).where(eq(permissions.id, id));
	}

	private mapToEntity(dbPermission: DbPermission): Permission {
		return {
			id: dbPermission.id,
			resource: dbPermission.resource,
			action: dbPermission.action,
			description: dbPermission.description ?? undefined,
			createdAt: dbPermission.createdAt,
		};
	}
}
