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

	// Semillas para permisos comunes
	async seedDefaultPermissions(): Promise<void> {
		const defaultPermissions: NewPermission[] = [
			// Proyectos
			{
				id: randomUUID(),
				resource: "projects",
				action: "create",
				description: "Crear proyectos",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "projects",
				action: "read",
				description: "Ver proyectos",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "projects",
				action: "update",
				description: "Actualizar proyectos",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "projects",
				action: "delete",
				description: "Eliminar proyectos",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "projects",
				action: "scan",
				description: "Escanear nuevamente el proyecto",
				createdAt: new Date().toISOString(),
			},

			// Secciones
			{
				id: randomUUID(),
				resource: "sections",
				action: "create",
				description: "Crear secciones",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "sections",
				action: "read",
				description: "Ver secciones",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "sections",
				action: "update",
				description: "Actualizar secciones",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "sections",
				action: "delete",
				description: "Eliminar secciones",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "sections",
				action: "request_changes",
				description: "Solicitar cambios de contenido en la sección",
				createdAt: new Date().toISOString(),
			},

			// Usuarios
			{
				id: randomUUID(),
				resource: "users",
				action: "create",
				description: "Crear usuarios",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "users",
				action: "read",
				description: "Ver usuarios",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "users",
				action: "update",
				description: "Actualizar usuarios",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "users",
				action: "delete",
				description: "Eliminar usuarios",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "users",
				action: "assign_role",
				description: "Asignar roles a usuarios",
				createdAt: new Date().toISOString(),
			},

			// Roles
			{
				id: randomUUID(),
				resource: "roles",
				action: "create",
				description: "Crear roles",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "roles",
				action: "read",
				description: "Ver roles",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "roles",
				action: "update",
				description: "Actualizar roles",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "roles",
				action: "delete",
				description: "Eliminar roles",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "roles",
				action: "assign_permission",
				description: "Asignar permisos a roles",
				createdAt: new Date().toISOString(),
			},

			// Permisos
			{
				id: randomUUID(),
				resource: "permissions",
				action: "create",
				description: "Crear permisos",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "permissions",
				action: "read",
				description: "Ver permisos",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "permissions",
				action: "delete",
				description: "Eliminar permisos",
				createdAt: new Date().toISOString(),
			},

			// Tareas Pendientes
			{
				id: randomUUID(),
				resource: "tasks",
				action: "create",
				description: "Crear tareas",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "tasks",
				action: "read",
				description: "Ver tareas",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "tasks",
				action: "update",
				description: "Actualizar tareas",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "tasks",
				action: "delete",
				description: "Eliminar tareas",
				createdAt: new Date().toISOString(),
			},

			// Búsqueda Semántica
			{
				id: randomUUID(),
				resource: "search",
				action: "read",
				description: "Realizar búsquedas semánticas",
				createdAt: new Date().toISOString(),
			},

			// Comentarios
			{
				id: randomUUID(),
				resource: "comments",
				action: "create",
				description: "Crear comentarios en secciones",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "comments",
				action: "read",
				description: "Leer comentarios de secciones",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "comments",
				action: "delete",
				description: "Eliminar comentarios propios",
				createdAt: new Date().toISOString(),
			},
			// Deep Search
			{
				id: randomUUID(),
				resource: "deep_search",
				action: "create",
				description: "Crear búsquedas profundas",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "deep_search",
				action: "read",
				description: "Leer búsquedas profundas",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "deep_search",
				action: "update",
				description: "Actualizar búsquedas profundas",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "deep_search",
				action: "delete",
				description: "Eliminar búsquedas profundas",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "agents",
				action: "create",
				description: "Crear agentes",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "agents",
				action: "delete",
				description: "Eliminar agentes",
				createdAt: new Date().toISOString(),
			},
			{
				id: randomUUID(),
				resource: "agents",
				action: "update",
				description: "Actualizar agentes",
				createdAt: new Date().toISOString(),
			},
		];

		// Usar upsert para cada permiso
		for (const permission of defaultPermissions) {
			// Verificar si existe
			const existing = await db
				.select()
				.from(permissions)
				.where(
					and(
						eq(permissions.resource, permission.resource),
						eq(permissions.action, permission.action),
					),
				);

			if (existing.length === 0) {
				// Insertar nuevo permiso
				await db.insert(permissions).values(permission);
			} else {
				// Actualizar descripción si cambió
				await db
					.update(permissions)
					.set({ description: permission.description })
					.where(eq(permissions.id, existing[0].id));
			}
		}

		console.log(
			`✅ Seeded ${defaultPermissions.length} default permissions (upserted)`,
		);
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
