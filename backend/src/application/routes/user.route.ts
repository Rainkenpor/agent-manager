import { z } from "zod";
import {
	CreateUserSchema,
	UpdateUserSchema,
} from "@domain/entities/user.entity.js";
import { registry } from "@application/services/registry.service.js";

export function registerUserRoutes() {
	// Listar usuarios
	registry.register({
		useBy: ["server"],
		path: "/api/users",
		method: "GET",
		handler: async ({ context: { res } }) => {
			const { container } = await import("@application/container.js");
			const userRepository = container.userRepository;

			try {
				const users = await userRepository.findAll();
				const usersWithoutPassword = users.map(({ password, ...user }) => user);
				return usersWithoutPassword;
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
		requiresAuth: true,
		requiredPermission: { resource: "users", action: "read" },
	});

	// Obtener usuario por ID
	registry.register({
		useBy: ["server"],
		path: "/api/users/:id",
		method: "GET",
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			const userRepository = container.userRepository;

			try {
				const user = await userRepository.findById(req.params.id);
				if (!user) {
					return res.status(404).json({ error: "Usuario no encontrado" });
				}

				const roles = await userRepository.getRoles(user.id);
				const permissions = await userRepository.getPermissions(user.id);

				const { password, ...userWithoutPassword } = user;
				return { ...userWithoutPassword, roles, permissions };
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
		inputSchema: z.object({ id: z.string() }),
		requiresAuth: true,
		requiredPermission: { resource: "users", action: "read" },
	});

	// Actualizar usuario
	registry.register({
		useBy: ["server"],
		path: "/api/users/:id",
		method: "PUT",
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			const userRepository = container.userRepository;

			try {
				const user = await userRepository.update(req.params.id, req.body);
				const { password, ...userWithoutPassword } = user;
				return userWithoutPassword;
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
		inputSchema: UpdateUserSchema,
		requiresAuth: true,
		requiredPermission: { resource: "users", action: "update" },
	});

	// Eliminar usuario
	registry.register({
		useBy: ["server"],
		path: "/api/users/:id",
		method: "DELETE",
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			const userRepository = container.userRepository;

			try {
				await userRepository.delete(req.params.id);
				return { success: true, message: "Usuario eliminado correctamente" };
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
		inputSchema: z.object({ id: z.string() }),
		requiresAuth: true,
		requiredPermission: { resource: "users", action: "delete" },
	});

	// Registro de usuario
	registry.register({
		useBy: ["server"],
		path: "/api/users/register",
		method: "POST",
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			const createUserUseCase = container.createUserUseCase;

			try {
				const user = await createUserUseCase.execute(req.body);
				const { password, ...userWithoutPassword } = user;
				res.status(201).json(userWithoutPassword);
			} catch (error: any) {
				res.status(400).json({ error: error.message });
			}
		},
		inputSchema: CreateUserSchema,
		requiresAuth: true,
		requiredPermission: { resource: "users", action: "create" },
	});

	// Asignar rol a usuario
	registry.register({
		useBy: ["server"],
		path: "/api/users/:userId/roles/:roleId",
		method: "POST",
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			const assignRoleUseCase = container.assignRoleUseCase;

			try {
				await assignRoleUseCase.execute({
					userId: req.params.userId,
					roleId: req.params.roleId,
				});
				return { message: "Rol asignado exitosamente" };
			} catch (error: any) {
				res.status(400).json({ error: error.message });
			}
		},
		inputSchema: z.object({
			userId: z.string(),
			roleId: z.string(),
		}),
		requiresAuth: true,
		requiredPermission: { resource: "users", action: "assign_role" },
	});

	// Remover rol de usuario
	registry.register({
		useBy: ["server"],
		path: "/api/users/:userId/roles/:roleId",
		method: "DELETE",
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			const userRepository = container.userRepository;

			try {
				await userRepository.removeRole(req.params.userId, req.params.roleId);
				return { success: true, message: "Rol eliminado correctamente" };
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
		inputSchema: z.object({
			userId: z.string(),
			roleId: z.string(),
		}),
		requiresAuth: true,
		requiredPermission: { resource: "users", action: "assign_role" },
	});
}
