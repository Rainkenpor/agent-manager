import { z } from "zod";

export const RoleSchema = z.object({
	id: z.string(),
	name: z.string().min(2),
	description: z.string().optional(),
	active: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

export const CreateRoleSchema = z.object({
	name: z.string().min(2),
	description: z.string().optional(),
});

export const UpdateRoleSchema = z.object({
	name: z.string().min(2).optional(),
	description: z.string().optional(),
	active: z.boolean().optional(),
});

export type Role = z.infer<typeof RoleSchema>;
export type CreateRole = z.infer<typeof CreateRoleSchema>;
export type UpdateRole = z.infer<typeof UpdateRoleSchema>;
