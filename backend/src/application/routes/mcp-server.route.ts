import { z } from "zod";
import { registry } from "@application/services/registry.service.js";
import {
	CreateMcpServerSchema,
	UpdateMcpServerSchema,
} from "@domain/entities/mcp-server.entity.js";

export function registerMcpServerRoutes(): void {
	// List all MCP servers
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/mcp-servers",
		inputSchema: {},
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "read" },
		handler: async () => {
			const { container } = await import("@application/container.js");
			const servers = await container.mcpServerRepository.findAll();
			return { success: true, data: servers };
		},
	});

	// Get MCP server by ID
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/mcp-servers/:id",
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "read" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			const server = await container.mcpServerRepository.findById(
				req.params.id,
			);
			if (!server)
				return res.status(404).json({ error: "MCP server not found" });
			return server;
		},
	});

	// Create MCP server
	registry.register({
		useBy: ["server"],
		method: "POST",
		path: "/api/mcp-servers",
		inputSchema: CreateMcpServerSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "create" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			try {
				const server = await container.mcpServerRepository.create(req.body);
				res.status(201).json(server);
			} catch (error: any) {
				res.status(400).json({ error: error.message });
			}
		},
	});

	// Update MCP server
	registry.register({
		useBy: ["server"],
		method: "PUT",
		path: "/api/mcp-servers/:id",
		inputSchema: UpdateMcpServerSchema.shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "update" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			try {
				const server = await container.mcpServerRepository.update(
					req.params.id,
					req.body,
				);
				return server;
			} catch (error: any) {
				res.status(400).json({ error: error.message });
			}
		},
	});

	// Delete MCP server
	registry.register({
		useBy: ["server"],
		method: "DELETE",
		path: "/api/mcp-servers/:id",
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "delete" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			try {
				await container.mcpServerRepository.delete(req.params.id);
				return { success: true, message: "MCP server deleted" };
			} catch (error: any) {
				res.status(400).json({ error: error.message });
			}
		},
	});

	// Assign MCP server to role
	registry.register({
		useBy: ["server"],
		method: "POST",
		path: "/api/roles/:roleId/mcps/:mcpServerId",
		inputSchema: z.object({ roleId: z.string(), mcpServerId: z.string() })
			.shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "update" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			try {
				await container.mcpServerRepository.assignToRole(
					req.params.roleId,
					req.params.mcpServerId,
				);
				return { message: "MCP server assigned to role" };
			} catch (error: any) {
				res.status(400).json({ error: error.message });
			}
		},
	});

	// Remove MCP server from role
	registry.register({
		useBy: ["server"],
		method: "DELETE",
		path: "/api/roles/:roleId/mcps/:mcpServerId",
		inputSchema: z.object({ roleId: z.string(), mcpServerId: z.string() })
			.shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "delete" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			try {
				await container.mcpServerRepository.removeFromRole(
					req.params.roleId,
					req.params.mcpServerId,
				);
				return { success: true, message: "MCP server removed from role" };
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
	});

	// Get MCPs assigned to a role
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/roles/:roleId/mcps",
		inputSchema: z.object({ roleId: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "read" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			try {
				const mcps = await container.mcpServerRepository.getByRole(
					req.params.roleId,
				);
				return { success: true, data: mcps };
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
	});

	// ── Role MCP Tool selection ───────────────────────────────────────────────

	// Get selected tools for a role+mcp pair
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/roles/:roleId/mcps/:mcpServerId/tools",
		inputSchema: z.object({ roleId: z.string(), mcpServerId: z.string() })
			.shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "read" },
		handler: async ({ context: { req } }) => {
			const { container } = await import("@application/container.js");
			const tools = await container.mcpServerRepository.getRoleMcpTools(
				req.params.roleId as string,
				req.params.mcpServerId as string,
			);
			return { success: true, data: tools };
		},
	});

	// Set (replace) selected tools for a role+mcp pair
	registry.register({
		useBy: ["server"],
		method: "PUT",
		path: "/api/roles/:roleId/mcps/:mcpServerId/tools",
		inputSchema: z.object({
			roleId: z.string(),
			mcpServerId: z.string(),
			tools: z.array(z.string()),
		}).shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "update" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			try {
				const toolNames: string[] = req.body.tools ?? [];
				await container.mcpServerRepository.setRoleMcpTools(
					req.params.roleId as string,
					req.params.mcpServerId as string,
					toolNames,
				);
				return { success: true, message: "Tool selection updated" };
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
	});

	// Discover available tools from an MCP server (connects and lists)
	registry.register({
		useBy: ["server"],
		method: "GET",
		path: "/api/mcp-servers/:id/tools",
		inputSchema: z.object({ id: z.string() }).shape,
		requiresAuth: true,
		requiredPermission: { resource: "mcp_servers", action: "read" },
		handler: async ({ context: { req, res } }) => {
			const { container } = await import("@application/container.js");
			const { mcpExternalManager } = await import(
				"@infra/service/mcp-external.js"
			);
			try {
				const server = await container.mcpServerRepository.findById(
					req.params.id as string,
				);
				if (!server)
					return res.status(404).json({ error: "MCP server not found" });
				await mcpExternalManager.ensureServerInitialized(server.name, server);
				const tools = mcpExternalManager.getToolsForServer(server.name);
				return {
					success: true,
					data: tools.map((t) => ({
						toolName: t.toolName,
						description: t.description,
					})),
				};
			} catch (error: any) {
				res.status(500).json({ error: error.message });
			}
		},
	});
}
