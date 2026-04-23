import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z, type ZodRawShape } from 'zod'
import type {
	HttpContext,
	HttpMethod,
	RegisteredPrompt,
	RegisteredRoute,
	RouterPromptConfig,
	RouteToolConfig
} from '../interfaces/route.interface.js'
import type { McpOAuthService } from '@infra/service/mcp-oauth.service.js'

/**
 * Registry that links Express routes with MCP tools
 * Each registered endpoint becomes both an HTTP route and an MCP tool
 */
export class RouteToolRegistry {
	private routes: RegisteredRoute[] = []
	private prompts: RegisteredPrompt[] = []

	register<T extends ZodRawShape | z.ZodObject<any>>(config: RouteToolConfig<T>): void {
		this.routes.push({
			// by server or/and mcp
			useBy: config.useBy,
			method: config.method,
			path: config.path,
			toolName: config.toolName,
			toolDescription: config.toolDescription,
			inputSchema: config.inputSchema as any, // Cast to any to avoid complex Zod generic issues
			handler: config.handler as (input: unknown, context?: any, oauthService?: McpOAuthService) => Promise<unknown>,
			requiresAuth: config.requiresAuth,
			requiredPermission: config.requiredPermission
		})
		// console.log(
		// 	`📝 Registered: ${config.method} ${config.path} → tool:${config.toolName}`,
		// );
	}

	/**
	 * Register a new prompt
	 */
	registerPrompt<T extends ZodRawShape>(config: RouterPromptConfig): void {
		this.prompts.push({
			toolName: config.toolName,
			toolDescription: config.toolDescription,
			handler: config.handler
		})
		console.log(`📝 Registered: ${config.toolName}`)
	}

	/**
	 * Apply all registered routes as tools to MCP Server
	 */
	applyToMcpServer({ server, sessionId }: { server: McpServer; sessionId: string }): void {
		const routes = this.routes.filter((r) => r.useBy.includes('mcp'))
		for (const route of routes) {
			if (!route.toolName || !route.toolDescription || !route.inputSchema) {
				console.warn('Route is missing toolName, toolDescription or inputSchema:', route.method, route.path)
				continue
			}
			// Ensure we have a valid ZodObject for MCP
			const inputSchema = route.inputSchema instanceof z.ZodObject ? route.inputSchema : z.object(route.inputSchema as ZodRawShape)

			server.tool(
				route.toolName,
				route.toolDescription,
				route.inputSchema, // Cast to any to avoid complex Zod generic issues
				async (args) => {
					try {
						// Validate with Zod
						const parseResult = inputSchema.safeParse(args)
						if (!parseResult.success) {
							return {
								content: [
									{
										type: 'text' as const,
										text: JSON.stringify({
											error: 'Validation error',
											details: parseResult.error.flatten()
										})
									}
								],
								isError: true
							}
						}

						// Get current context for this session
						const sessionContext = this.getSessionContext(sessionId)

						// Execute handler
						const result = await route.handler({
							input: parseResult.data,
							context: sessionContext
						})
						return {
							content: [
								{
									type: 'text' as const,
									text: JSON.stringify(result, null, 2)
								}
							]
						}
					} catch (error) {
						return {
							content: [
								{
									type: 'text' as const,
									text: JSON.stringify({
										error: error instanceof Error ? error.message : 'Unknown error'
									})
								}
							],
							isError: true
						}
					}
				}
			)
		}
		console.log(`🤖 Applied ${this.routes.length} tools to MCP Server`)

		for (const prompt of this.prompts) {
			server.registerPrompt(
				prompt.toolName,
				{
					title: prompt.toolDescription,
					description: prompt.toolDescription
				},
				async () => {
					const result = await prompt.handler()
					// Asegurar que el resultado tenga la estructura correcta para MCP
					if (typeof result === 'object' && result !== null && 'messages' in result) {
						return result as any // Type assertion temporal para MCP
					}
					// Fallback si el resultado no tiene el formato correcto
					return {
						messages: [
							{
								role: 'user' as const,
								content: {
									type: 'text' as const,
									text: typeof result === 'string' ? result : JSON.stringify(result)
								}
							}
						]
					}
				}
			)
		}
		console.log(`📝 Applied ${this.prompts.length} prompts to MCP Server`)
	}

	/**
	 * Get list of registered tools for debugging
	 */
	getRoutes(): RegisteredRoute[] {
		return this.routes
	}

	/**
	 * Get list of registered tools for debugging
	 */
	getRegisteredTools(): Array<{
		name?: string
		description?: string
		method: HttpMethod
		path: string
	}> {
		return this.routes.map((r) => ({
			name: r.toolName,
			description: r.toolDescription,
			method: r.method,
			path: r.path
		}))
	}

	/**
	 * Get session context dynamically from mcp.route.ts
	 * This is set externally by the MCP route handler
	 */
	private getSessionContext(sessionId: string): HttpContext {
		// @ts-ignore - Access to internal sessionContexts from mcp.route.ts
		return (
			globalThis.__mcpSessionContexts?.[sessionId] || {
				req: {},
				res: {},
				next: () => {}
			}
		)
	}
}

// Singleton instance
export const registry = new RouteToolRegistry()
