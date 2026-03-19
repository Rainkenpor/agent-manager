import type { McpServerEntity, CreateMcpServer, UpdateMcpServer } from "@domain/entities/mcp-server.entity.js"

export interface IMcpServerRepository {
  create(data: CreateMcpServer): Promise<McpServerEntity>
  findAll(): Promise<McpServerEntity[]>
  findById(id: string): Promise<McpServerEntity | null>
  findByName(name: string): Promise<McpServerEntity | null>
  update(id: string, data: UpdateMcpServer): Promise<McpServerEntity>
  delete(id: string): Promise<void>

  // Role associations
  assignToRole(roleId: string, mcpServerId: string): Promise<void>
  removeFromRole(roleId: string, mcpServerId: string): Promise<void>
  getByRole(roleId: string): Promise<McpServerEntity[]>

  // Agent associations on roles
  assignAgentToRole(roleId: string, agentId: string): Promise<void>
  removeAgentFromRole(roleId: string, agentId: string): Promise<void>
  getAgentsByRole(roleId: string): Promise<Array<{ id: string; name: string; slug: string; mode: string }>>
}
