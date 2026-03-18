import type { IUserRepository } from "@domain/repositories/user.repository.js";

export interface CheckPermissionInput {
	userId: string;
	resource: string;
	action: string;
}

export class CheckPermissionUseCase {
	constructor(private userRepository: IUserRepository) {}

	async execute(input: CheckPermissionInput): Promise<boolean> {
		return await this.userRepository.hasPermission(
			input.userId,
			input.resource,
			input.action,
		);
	}
}
