import { z } from "zod";
import { LoginSchema, CreateUserSchema } from "@domain/entities/user.entity.js";
import passport from "passport";
import { registry } from "@application/services/registry.service.js";

export function registerAuthRoutes() {
	// Login
	registry.register({
		useBy: ["server"],
		path: "/api/auth/login",
		method: "POST",
		handler: async ({ context: { req, res, next } }) => {
			return new Promise((resolve) => {
				passport.authenticate(
					"local",
					{ session: false },
					async (err: any, user: any, info: any) => {
						if (err) {
							res.status(500).json({ error: "Error de autenticación" });
							return resolve(null);
						}

						console.log(req.body);

						if (!user) {
							res.status(401).json({
								error: info?.message || "Credenciales inválidas",
							});
							return resolve(null);
						}

						try {
							const { container } = await import("@application/container.js");
							const loginUseCase = container.loginUseCase;
							const result = await loginUseCase.execute(user);

							res.json(result);
							resolve(null);
						} catch (error: any) {
							res.status(500).json({ error: error.message });
							resolve(null);
						}
					},
				)(req, res, next);
			});
		},
		inputSchema: LoginSchema,
	});

	// Obtener perfil del usuario actual
	registry.register({
		useBy: ["server"],
		path: "/api/auth/me",
		method: "GET",
		handler: async ({ context: { req, res, next } }) => {
			if (!req.user) {
				return res.status(401).json({ error: "No autorizado" });
			}

			const { container } = await import("@application/container.js");
			const userRepository = container.userRepository;

			try {
				const roles = await userRepository.getRoles(req.user.id);
				const permissions = await userRepository.getPermissions(req.user.id);

				const { password, ...userWithoutPassword } = req.user;

				return {
					...userWithoutPassword,
					roles,
					permissions,
				};
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
		requiresAuth: true,
	});

	// Verificar permiso específico
	registry.register({
		useBy: ["server"],
		path: "/api/auth/check-permission",
		method: "POST",
		handler: async ({ context: { req, res, next } }) => {
			if (!req.user) {
				return res.status(401).json({ error: "No autorizado" });
			}

			const { container } = await import("@application/container.js");
			const checkPermissionUseCase = container.checkPermissionUseCase;

			try {
				const hasPermission = await checkPermissionUseCase.execute({
					userId: req.user.id,
					resource: req.body.resource,
					action: req.body.action,
				});

				res.json({ hasPermission });
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
		inputSchema: z.object({
			resource: z.string(),
			action: z.string(),
		}),
		requiresAuth: true,
	});
}
