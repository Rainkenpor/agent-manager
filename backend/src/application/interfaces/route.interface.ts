import type { McpOAuthService } from '@infra/service/mcp-oauth.service.js'
import type { NextFunction, Request, Response } from 'express'
import type { ZodRawShape, z } from 'zod'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type RouteUseBy = 'server' | 'mcp'

export interface AuthenticatedRequest extends Request {
	user?: any
}

export interface HttpContext {
	req: AuthenticatedRequest
	res: Response
	next: NextFunction
	signal: AbortSignal
}

export interface RouteToolConfig<T extends ZodRawShape | z.ZodObject<any>> {
	// By which servers this route is available
	useBy: RouteUseBy[]

	// HTTP Route config
	method: HttpMethod
	path: string

	// MCP Tool config
	toolName?: string
	toolDescription?: string
	toolSource?: string
	toolAlwaysAvailable?: boolean
	toolAvailableViaChat?: boolean
	toolShowAssignment?: boolean

	// Shared validation schema (Zod)
	inputSchema?: T

	// Unified handler
	handler: ({
		input,
		context,
		oauthService
	}: {
		input: T extends z.ZodObject<any> ? z.infer<T> : z.infer<z.ZodObject<Extract<T, ZodRawShape>>>
		context: HttpContext
		oauthService: McpOAuthService
	}) => Promise<unknown>

	// Authentication & Authorization
	requiresAuth?: boolean
	requiredPermission?: { resource: string; action: string }
}

export interface RouterPromptConfig {
	// MCP Tool config
	toolName: string
	toolDescription: string

	// Unified handler
	handler: () => Promise<unknown>
}

export interface RegisteredRoute {
	useBy: RouteUseBy[]
	method: HttpMethod
	path: string
	toolName?: string
	toolDescription?: string
	toolSource?: string
	inputSchema: ZodRawShape
	toolAlwaysAvailable?: boolean
	toolAvailableViaChat?: boolean
	toolShowAssignment?: boolean
	handler: ({ input, context, oauthService }: { input: unknown; context?: HttpContext; oauthService?: McpOAuthService }) => Promise<unknown>
	requiresAuth?: boolean
	requiredPermission?: { resource: string; action: string }
}

export interface RegisteredPrompt {
	toolName: string
	toolDescription: string
	handler: () => Promise<unknown>
}
