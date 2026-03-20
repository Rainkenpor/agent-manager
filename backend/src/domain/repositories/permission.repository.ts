import type {
	Permission,
	CreatePermission,
} from "@domain/entities/permission.entity.js";

export interface IPermissionRepository {
	create(data: CreatePermission): Promise<Permission>;
	findById(id: string): Promise<Permission | null>;
	findByResourceAndAction(
		resource: string,
		action: string,
	): Promise<Permission | null>;
	findAll(): Promise<Permission[]>;
	delete(id: string): Promise<void>;
}
