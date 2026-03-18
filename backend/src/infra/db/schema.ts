import {
	sqliteTable,
	text,
	integer,
	type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

// Tabla de Usuarios
export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	email: text("email").notNull().unique(),
	username: text("username").notNull().unique(),
	password: text("password").notNull(), // Hash bcrypt
	firstName: text("first_name"),
	lastName: text("last_name"),
	active: integer("active", { mode: "boolean" }).notNull().default(true),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	lastLoginAt: text("last_login_at"),
});

// Tabla de Roles
export const roles = sqliteTable("roles", {
	id: text("id").primaryKey(),
	name: text("name").notNull().unique(),
	description: text("description"),
	active: integer("active", { mode: "boolean" }).notNull().default(true),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Tabla de Permisos
export const permissions = sqliteTable("permissions", {
	id: text("id").primaryKey(),
	resource: text("resource").notNull(), // Ej: "projects", "sections", "users"
	action: text("action").notNull(), // Ej: "create", "read", "update", "delete"
	description: text("description"),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Relación muchos a muchos: Usuarios - Roles
export const userRoles = sqliteTable("user_roles", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),
	roleId: text("role_id")
		.notNull()
		.references(() => roles.id, { onDelete: "cascade" }),
	assignedAt: text("assigned_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Relación muchos a muchos: Roles - Permisos
export const rolePermissions = sqliteTable("role_permissions", {
	id: text("id").primaryKey(),
	roleId: text("role_id")
		.notNull()
		.references(() => roles.id, { onDelete: "cascade" }),
	permissionId: text("permission_id")
		.notNull()
		.references(() => permissions.id, { onDelete: "cascade" }),
	assignedAt: text("assigned_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Tabla de Agentes (Markdown agents para IA)
export const agents = sqliteTable("agents", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(), // nombre del archivo .md
	description: text("description"),
	mode: text("mode", { enum: ["primary", "subagent"] })
		.notNull()
		.default("subagent"),
	model: text("model").notNull().default("<<AGENT_MODEL>>"),
	temperature: text("temperature").notNull().default("0.2"), // almacenado como string para evitar precision issues
	tools: text("tools", { mode: "json" })
		.notNull()
		.$default(() => ({})), // Record<string, boolean>
	content: text("content").notNull().default(""), // Cuerpo markdown sin frontmatter
	isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	updatedAt: text("updated_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Tabla de relación Agente → Subagentes (muchos-a-muchos self-referencial)
export const agentSubagents = sqliteTable("agent_subagents", {
	id: text("id").primaryKey(),
	agentId: text("agent_id")
		.notNull()
		.references(() => agents.id, { onDelete: "cascade" }),
	subagentId: text("subagent_id")
		.notNull()
		.references(() => agents.id, { onDelete: "cascade" }),
	order: integer("order").notNull().default(0),
	createdAt: text("created_at")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
});

// Tipos inferidos
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentSubagent = typeof agentSubagents.$inferSelect;
export type NewAgentSubagent = typeof agentSubagents.$inferInsert;
