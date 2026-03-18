import type { IRoleRepository } from "@domain/repositories/role.repository.js";
import type { IPermissionRepository } from "@domain/repositories/permission.repository.js";

export interface AssignPermissionInput {
	roleId: string;
	permissionId: string;
}

export class AssignPermissionUseCase {
	constructor(
		private roleRepository: IRoleRepository,
		private permissionRepository: IPermissionRepository,
	) {}

	async execute(input: AssignPermissionInput): Promise<void> {
		// Verificar que el rol exista
		const role = await this.roleRepository.findById(input.roleId);
		if (!role) {
			throw new Error("Rol no encontrado");
		}

		// Verificar que el permiso exista
		const permission = await this.permissionRepository.findById(
			input.permissionId,
		);
		if (!permission) {
			throw new Error("Permiso no encontrado");
		}

		// Verificar que el rol no tenga ya ese permiso
		const rolePermissions = await this.roleRepository.getPermissions(
			input.roleId,
		);
		if (rolePermissions.some((p) => p.id === input.permissionId)) {
			throw new Error("El rol ya tiene este permiso asignado");
		}

		await this.roleRepository.assignPermission(
			input.roleId,
			input.permissionId,
		);
	}
}
