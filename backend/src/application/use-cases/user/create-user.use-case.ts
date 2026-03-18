import type { IUserRepository } from "@domain/repositories/user.repository.js";
import type { CreateUser, User } from "@domain/entities/user.entity.js";

export class CreateUserUseCase {
	constructor(private userRepository: IUserRepository) {}

	async execute(data: CreateUser): Promise<User> {
		// Verificar que el email no exista
		const existingEmail = await this.userRepository.findByEmail(data.email);
		if (existingEmail) {
			throw new Error("El email ya está en uso");
		}

		// Verificar que el username no exista
		const existingUsername = await this.userRepository.findByUsername(
			data.username,
		);
		if (existingUsername) {
			throw new Error("El nombre de usuario ya está en uso");
		}

		return await this.userRepository.create(data);
	}
}
