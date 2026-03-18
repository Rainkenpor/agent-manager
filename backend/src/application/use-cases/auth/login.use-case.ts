import jwt from "jsonwebtoken";
import type { IUserRepository } from "@domain/repositories/user.repository.js";
import type { User } from "@domain/entities/user.entity.js";
import { JWT_SECRET } from "@infra/service/passport.service.js";

export interface AuthResponse {
	user: Omit<User, "password">;
	token: string;
}

export class LoginUseCase {
	constructor(private userRepository: IUserRepository) {}

	async execute(user: User): Promise<AuthResponse> {
		// Generar JWT token
		const token = jwt.sign(
			{ sub: user.id, username: user.username, email: user.email },
			JWT_SECRET,
			{ expiresIn: "7d" },
		);

		// Obtener roles y permisos del usuario
		const roles = await this.userRepository.getRoles(user.id);
		const permissions = await this.userRepository.getPermissions(user.id);

		// Retornar usuario sin password
		const { password, ...userWithoutPassword } = user;

		return {
			user: {
				...userWithoutPassword,
				roles,
				permissions,
			} as any,
			token,
		};
	}
}
