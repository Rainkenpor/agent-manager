import type {
	Role,
	CreateRole,
	UpdateRole,
} from "@domain/entities/role.entity.js";

export interface IRoleRepository {
	create(data: CreateRole): Promise<Role>;
	findById(id: string): Promise<Role | null>;
	findByName(name: string): Promise<Role | null>;
	findAll(filters?: { active?: boolean }): Promise<Role[]>;
	update(id: string, data: UpdateRole): Promise<Role>;
	delete(id: string): Promise<void>;

	// Gestión de permisos
	assignPermission(roleId: string, permissionId: string): Promise<void>;
	removePermission(roleId: string, permissionId: string): Promise<void>;
	getPermissions(
		roleId: string,
	): Promise<Array<{ id: string; resource: string; action: string }>>;
}
