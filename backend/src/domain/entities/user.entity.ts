import { z } from "zod";

export const UserSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	username: z.string().min(3),
	password: z.string(), // Hash bcrypt
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	active: z.boolean(),
	createdAt: z.string(),
	updatedAt: z.string(),
	lastLoginAt: z.string().optional(),
});

export const CreateUserSchema = z.object({
	email: z.string().email(),
	username: z.string().min(3),
	password: z.string().min(8),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
});

export const UpdateUserSchema = z.object({
	email: z.string().email().optional(),
	username: z.string().min(3).optional(),
	password: z.string().min(8).optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	active: z.boolean().optional(),
});

export const LoginSchema = z.object({
	username: z.string(),
	password: z.string(),
});

export type User = z.infer<typeof UserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type Login = z.infer<typeof LoginSchema>;
