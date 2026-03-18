import type { Request, Response, NextFunction } from "express";
import passport from "passport";

export interface AuthenticatedRequest extends Request {
	user?: any;
}

// Middleware para requerir autenticación JWT
export const requireAuth = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
) => {
	passport.authenticate(
		"jwt",
		{ session: false },
		(err: any, user: any, info: any) => {
			if (err) {
				return res.status(500).json({ error: "Error de autenticación" });
			}

			if (!user) {
				return res.status(401).json({ error: "No autorizado" });
			}

			req.user = user;
			next();
		},
	)(req, res, next);
};

// Middleware para verificar permisos
export const requirePermission = (resource: string, action: string) => {
	return async (
		req: AuthenticatedRequest,
		res: Response,
		next: NextFunction,
	) => {
		if (!req.user) {
			return res.status(401).json({ error: "No autorizado" });
		}

		const { container } = await import("@application/container.js");
		const checkPermissionUseCase = container.checkPermissionUseCase;

		try {
			const hasPermission = await checkPermissionUseCase.execute({
				userId: req.user.id,
				resource,
				action,
			});

			if (!hasPermission) {
				return res.status(403).json({
					error: "No tienes permisos para realizar esta acción",
					required: `${resource}:${action}`,
				});
			}

			next();
		} catch (error) {
			return res.status(500).json({ error: "Error al verificar permisos" });
		}
	};
};

// Middleware combinado: autenticación + permisos
export const requireAuthAndPermission = (resource: string, action: string) => {
	return [requireAuth, requirePermission(resource, action)];
};
