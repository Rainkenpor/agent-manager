import { z } from "zod";

export const PermissionSchema = z.object({
	id: z.string(),
	resource: z.string().min(2), // "projects", "sections", "users", "roles", "permissions"
	action: z.string().min(2), // "create", "read", "update", "delete", "assign"
	description: z.string().optional(),
	createdAt: z.string(),
});

export const CreatePermissionSchema = z.object({
	resource: z.string().min(2),
	action: z.string().min(2),
	description: z.string().optional(),
});

// Formato: resource:action (ej: "projects:create", "users:delete")
export const PermissionKeySchema = z.string().regex(/^[\w-]+:[\w-]+$/);

export type Permission = z.infer<typeof PermissionSchema>;
export type CreatePermission = z.infer<typeof CreatePermissionSchema>;
export type PermissionKey = z.infer<typeof PermissionKeySchema>;
