import type { IUserRepository } from "@domain/repositories/user.repository.js";
import type { IRoleRepository } from "@domain/repositories/role.repository.js";

export interface AssignRoleInput {
	userId: string;
	roleId: string;
}

export class AssignRoleUseCase {
	constructor(
		private userRepository: IUserRepository,
		private roleRepository: IRoleRepository,
	) {}

	async execute(input: AssignRoleInput): Promise<void> {
		// Verificar que el usuario exista
		const user = await this.userRepository.findById(input.userId);
		if (!user) {
			throw new Error("Usuario no encontrado");
		}

		// Verificar que el rol exista
		const role = await this.roleRepository.findById(input.roleId);
		if (!role) {
			throw new Error("Rol no encontrado");
		}

		// Verificar que el usuario no tenga ya ese rol
		const userRoles = await this.userRepository.getRoles(input.userId);
		if (userRoles.some((r) => r.id === input.roleId)) {
			throw new Error("El usuario ya tiene este rol asignado");
		}

		await this.userRepository.assignRole(input.userId, input.roleId);
	}
}
