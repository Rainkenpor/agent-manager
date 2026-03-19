import { z } from "zod"

export const McpServerSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  type: z.enum(["http", "stdio"]),
  url: z.string().nullable().optional(),
  command: z.string().nullable().optional(),
  args: z.array(z.string()).nullable().optional(),
  headers: z.record(z.string(), z.string()).nullable().optional(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const CreateMcpServerSchema = z.object({
  name: z.string().min(1).regex(/^[a-z0-9-_]+$/),
  displayName: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(["http", "stdio"]).default("http"),
  url: z.string().url().optional(),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  active: z.boolean().default(true),
})

export const UpdateMcpServerSchema = CreateMcpServerSchema.partial()

export type McpServerEntity = z.infer<typeof McpServerSchema>
export type CreateMcpServer = z.infer<typeof CreateMcpServerSchema>
export type UpdateMcpServer = z.infer<typeof UpdateMcpServerSchema>
