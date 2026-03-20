import type {
	User,
	CreateUser,
	UpdateUser,
} from "@domain/entities/user.entity.js";

export interface IUserRepository {
	create(data: CreateUser): Promise<User>;
	findById(id: string): Promise<User | null>;
	findByEmail(email: string): Promise<User | null>;
	findByUsername(username: string): Promise<User | null>;
	findAll(filters?: {
		active?: boolean;
	}): Promise<
		(User & {
			isActive: boolean;
			roles?: Array<{ id: string; name: string }>;
		})[]
	>;
	update(id: string, data: UpdateUser): Promise<User>;
	delete(id: string): Promise<void>;
	updateLastLogin(id: string): Promise<void>;

	// Gestión de roles
	assignRole(userId: string, roleId: string): Promise<void>;
	removeRole(userId: string, roleId: string): Promise<void>;
	getRoles(userId: string): Promise<Array<{ id: string; name: string }>>;

	// Verificación de permisos
	hasPermission(
		userId: string,
		resource: string,
		action: string,
	): Promise<boolean>;
	getPermissions(
		userId: string,
	): Promise<Array<{ resource: string; action: string }>>;
}
