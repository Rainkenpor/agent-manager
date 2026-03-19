import { z } from "zod"
import { registry } from "@application/services/registry.service.js"
import { CreateMcpServerSchema, UpdateMcpServerSchema } from "@domain/entities/mcp-server.entity.js"

export function registerMcpServerRoutes(): void {
  // List all MCP servers
  registry.register({
    useBy: ["server"],
    method: "GET",
    path: "/api/mcp-servers",
    inputSchema: {},
    requiresAuth: true,
    handler: async () => {
      const { container } = await import("@application/container.js")
      const servers = await container.mcpServerRepository.findAll()
      return { success: true, data: servers }
    },
  })

  // Get MCP server by ID
  registry.register({
    useBy: ["server"],
    method: "GET",
    path: "/api/mcp-servers/:id",
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      const server = await container.mcpServerRepository.findById(req.params.id)
      if (!server) return res.status(404).json({ error: "MCP server not found" })
      return server
    },
  })

  // Create MCP server
  registry.register({
    useBy: ["server"],
    method: "POST",
    path: "/api/mcp-servers",
    inputSchema: CreateMcpServerSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: "mcp_servers", action: "create" },
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        const server = await container.mcpServerRepository.create(req.body)
        res.status(201).json(server)
      } catch (error: any) {
        res.status(400).json({ error: error.message })
      }
    },
  })

  // Update MCP server
  registry.register({
    useBy: ["server"],
    method: "PUT",
    path: "/api/mcp-servers/:id",
    inputSchema: UpdateMcpServerSchema.shape,
    requiresAuth: true,
    requiredPermission: { resource: "mcp_servers", action: "update" },
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        const server = await container.mcpServerRepository.update(req.params.id, req.body)
        return server
      } catch (error: any) {
        res.status(400).json({ error: error.message })
      }
    },
  })

  // Delete MCP server
  registry.register({
    useBy: ["server"],
    method: "DELETE",
    path: "/api/mcp-servers/:id",
    inputSchema: z.object({ id: z.string() }).shape,
    requiresAuth: true,
    requiredPermission: { resource: "mcp_servers", action: "delete" },
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        await container.mcpServerRepository.delete(req.params.id)
        return { success: true, message: "MCP server deleted" }
      } catch (error: any) {
        res.status(400).json({ error: error.message })
      }
    },
  })

  // Assign MCP server to role
  registry.register({
    useBy: ["server"],
    method: "POST",
    path: "/api/roles/:roleId/mcps/:mcpServerId",
    inputSchema: z.object({ roleId: z.string(), mcpServerId: z.string() }).shape,
    requiresAuth: true,
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        await container.mcpServerRepository.assignToRole(req.params.roleId, req.params.mcpServerId)
        return { message: "MCP server assigned to role" }
      } catch (error: any) {
        res.status(400).json({ error: error.message })
      }
    },
  })

  // Remove MCP server from role
  registry.register({
    useBy: ["server"],
    method: "DELETE",
    path: "/api/roles/:roleId/mcps/:mcpServerId",
    inputSchema: z.object({ roleId: z.string(), mcpServerId: z.string() }).shape,
    requiresAuth: true,
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        await container.mcpServerRepository.removeFromRole(req.params.roleId, req.params.mcpServerId)
        return { success: true, message: "MCP server removed from role" }
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    },
  })

  // Get MCPs assigned to a role
  registry.register({
    useBy: ["server"],
    method: "GET",
    path: "/api/roles/:roleId/mcps",
    inputSchema: z.object({ roleId: z.string() }).shape,
    requiresAuth: true,
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        const mcps = await container.mcpServerRepository.getByRole(req.params.roleId)
        return { success: true, data: mcps }
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    },
  })

  // Assign agent to role
  registry.register({
    useBy: ["server"],
    method: "POST",
    path: "/api/roles/:roleId/agents/:agentId",
    inputSchema: z.object({ roleId: z.string(), agentId: z.string() }).shape,
    requiresAuth: true,
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        await container.mcpServerRepository.assignAgentToRole(req.params.roleId, req.params.agentId)
        return { message: "Agent assigned to role" }
      } catch (error: any) {
        res.status(400).json({ error: error.message })
      }
    },
  })

  // Remove agent from role
  registry.register({
    useBy: ["server"],
    method: "DELETE",
    path: "/api/roles/:roleId/agents/:agentId",
    inputSchema: z.object({ roleId: z.string(), agentId: z.string() }).shape,
    requiresAuth: true,
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        await container.mcpServerRepository.removeAgentFromRole(req.params.roleId, req.params.agentId)
        return { success: true, message: "Agent removed from role" }
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    },
  })

  // Get agents assigned to a role
  registry.register({
    useBy: ["server"],
    method: "GET",
    path: "/api/roles/:roleId/agents",
    inputSchema: z.object({ roleId: z.string() }).shape,
    requiresAuth: true,
    handler: async ({ context: { req, res } }) => {
      const { container } = await import("@application/container.js")
      try {
        const agentList = await container.mcpServerRepository.getAgentsByRole(req.params.roleId)
        return { success: true, data: agentList }
      } catch (error: any) {
        res.status(500).json({ error: error.message })
      }
    },
  })
}
