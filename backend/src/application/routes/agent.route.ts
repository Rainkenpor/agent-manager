import { registry } from "@applicationService/registry.service.js";
import { listAvailableAgentTools } from "@applicationService/agent-tools.service.js";
import { container } from "../container.js";
import { z } from "zod";

const createAgentSchema = z.object({
	name: z.string().min(1),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/),
	description: z.string().optional(),
	mode: z.enum(["primary", "subagent"]).default("subagent"),
	model: z.string().default("<<AGENT_MODEL>>"),
	temperature: z.string().default("0.2"),
	tools: z.record(z.string(), z.boolean()).default({}),
	content: z.string().default(""),
	subagentIds: z.array(z.string()).optional(),
});

const updateAgentSchema = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	slug: z
		.string()
		.min(1)
		.regex(/^[a-z0-9-]+$/)
		.optional(),
	description: z.string().nullable().optional(),
	mode: z.enum(["primary", "subagent"]).optional(),
	model: z.string().optional(),
	temperature: z.string().optional(),
	tools: z.record(z.string(), z.boolean()).optional(),
	content: z.string().optional(),
	useByChat: z.boolean().optional(),
	isActive: z.boolean().optional(),
	subagentIds: z.array(z.string()).optional(),
});

const getAgentSchema = z.object({ id: z.string() });
const deleteAgentSchema = z.object({ id: z.string() });
const getAgent = z.object({});

export function registerAgentRoutes(): void {
	// ==========================================
	// AGENT ROUTES
	// ==========================================

	// List available tools (builtin + registry + external MCP)
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/agents/tools",
		inputSchema: {},
		handler: async () => {
			const tools = await listAvailableAgentTools();
			return { success: true, data: tools };
		},
	});

	// List all agents
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/agents",
		toolName: "list_agents",
		toolDescription:
			"Lista todos los agentes y subagentes definidos en el sistema, con sus herramientas y subagentes referenciados.",
		inputSchema: getAgent.shape,
		handler: async ({ input }) => {
			return await container.listAgentsUseCase.execute(input);
		},
	});

	// Get agent by ID
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/agents/:id",
		toolName: "get_agent",
		toolDescription:
			"Obtiene el detalle completo de un agente por su ID, incluyendo sus subagentes y herramientas asignadas.",
		inputSchema: getAgentSchema.shape,
		handler: async ({ input }) => {
			return await container.getAgentUseCase.execute(input.id);
		},
	});

	// Create agent
	registry.register({
		useBy: ["server"],
		method: "POST",
		path: "/api/agents",
		toolName: "create_agent",
		toolDescription:
			"Crea un nuevo agente markdown. Requiere name, slug (solo minúsculas-guiones), mode (primary|subagent). " +
			"El campo tools es un objeto con claves siendo el nombre de la herramienta y valor booleano. " +
			"Guarda automáticamente el archivo .md en Server/agent o Server/agent/subagents según el mode.",
		inputSchema: createAgentSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: "agents", action: "create" },
		handler: async ({ input }) => {
			return await container.createAgentUseCase.execute({
				...input,
				tools: (input.tools ?? {}) as Record<string, boolean>,
			});
		},
	});

	// Update agent
	registry.register({
		useBy: ["server"],
		method: "PUT",
		path: "/api/agents/:id",
		toolName: "update_agent",
		toolDescription:
			"Actualiza un agente existente. Todos los campos son opcionales excepto id. " +
			"Si se cambia el slug, el archivo anterior se elimina y se crea uno nuevo. " +
			"Si se cambia el mode, el archivo se mueve al directorio correspondiente.",
		inputSchema: updateAgentSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: "agents", action: "update" },
		handler: async ({ input }) => {
			return await container.updateAgentUseCase.execute({
				...input,
				tools: input.tools as Record<string, boolean> | undefined,
			});
		},
	});

	// Delete agent
	registry.register({
		useBy: ["server"],
		method: "DELETE",
		path: "/api/agents/:id",
		toolName: "delete_agent",
		toolDescription:
			"Elimina un agente y su archivo .md del sistema. No elimina los subagentes referenciados, solo la relación.",
		inputSchema: deleteAgentSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: "agents", action: "delete" },
		handler: async ({ input }) => {
			return await container.deleteAgentUseCase.execute(input.id);
		},
	});
}
