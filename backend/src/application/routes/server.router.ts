import {
	requireAuth,
	requirePermission,
} from "@application/interfaces/auth.middleware.js";
import { registry } from "@application/services/registry.service.js";
import type { McpOAuthService } from "@infra/service/mcp-oauth.service.js";
import express, {
	type Request,
	type Response,
	type NextFunction,
} from "express";
import { z } from "zod";
/**
 * Creates the Express router for the standard API based on registered routes.
 */
export function registerServerRoutes(
	oauthService?: McpOAuthService,
): express.Router {
	const router = express.Router();

	for (const route of registry
		.getRoutes()
		.filter((r) => r.useBy.includes("server"))) {
		const expressMethod = route.method.toLowerCase() as
			| "get"
			| "post"
			| "put"
			| "delete"
			| "patch";

		// Preparar middlewares
		const middlewares: any[] = [];

		// Agregar middleware de autenticación si es necesario
		if (route.requiresAuth) {
			middlewares.push(requireAuth);
		}

		// Agregar middleware de permisos si es necesario
		if (route.requiredPermission) {
			middlewares.push(
				requirePermission(
					route.requiredPermission.resource,
					route.requiredPermission.action,
				),
			);
		}

		// Agregar handler principal
		middlewares.push(
			async (req: Request, res: Response, next: NextFunction) => {
				try {
					// Combine params, query, and body for input
					const rawInput = {
						...req.params,
						...req.query,
						...req.body,
					};

					// Validate input with Zod
					const inputSchema =
						route.inputSchema instanceof z.ZodObject
							? route.inputSchema
							: z.object(route.inputSchema);

					const parseResult = inputSchema.safeParse(rawInput);
					if (!parseResult.success) {
						const error = parseResult.error.flatten();
						return res.status(400).json({
							error: "Validation error",
							details: Object.entries(error.fieldErrors).map(
								([key, value]) => `${key}: ${value}`,
							),
							formErrors: error.formErrors,
						});
					}

					// Execute handler with context
					const result = await route.handler({
						input: parseResult.data,
						context: {
							req,
							res,
							next,
						},
						oauthService,
					});

					// Only send response if handler didn't handle it (result is not null)
					if (result !== null) {
						// console.log(req.method, req.url);
						res.json(result);
					}
				} catch (error) {
					next(error);
				}
			},
		);

		router[expressMethod](route.path, ...middlewares);
	}

	console.log(
		`🌐 API Router created with ${registry.getRoutes().length} routes`,
	);

	return router;
}
