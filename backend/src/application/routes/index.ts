import { registerAgentRoutes } from './agent.route.js'
import { registerAuthRoutes } from './auth.route.js'
import { registerUserRoutes } from './user.route.js'
import { registerRoleRoutes } from './role.route.js'
import { registerMcpServerRoutes } from './mcp-server.route.js'
import { registerOAuthRoutes } from './oauth.route.js'
import { registerChatRoutes } from './chat.route.js'
import { registerMcpCredentialRoutes } from './mcp-credential.route.js'
import { registerSkillRoutes } from './skill.route.js'
import { registerTraceabilityRoutes } from './traceability.route.js'
import { registerLogsRoutes } from './logs.route.js'
import { registerHookServerRoutes } from './hook-server.route.js'
import { registerEventListenerRoutes } from './event-listener.route.js'
import { registerConfigRoutes } from './config.route.js'

/**
 * Initializes the registry by calling all registration functions.
 * This must be called before creating routers or starting the MCP server.
 */
export function initializeRegistry(): void {
	registerAuthRoutes()
	registerUserRoutes()
	registerRoleRoutes()
	registerAgentRoutes()
	registerMcpServerRoutes()
	registerOAuthRoutes()
	registerChatRoutes()
	registerMcpCredentialRoutes()
	registerSkillRoutes()
	registerTraceabilityRoutes()
	registerLogsRoutes()
	registerHookServerRoutes()
	registerEventListenerRoutes()
	registerConfigRoutes()
}
