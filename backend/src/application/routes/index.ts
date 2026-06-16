import { registerAgentRoutes } from './agent.route.js'
import { registerAgentGroupRoutes } from './agent-group.route.js'
import { registerAiAssistRoutes } from './ai-assist.route.js'
import { registerAuthRoutes } from './auth.route.js'
import { registerChatRoutes } from './chat.route.js'
import { registerClarifyRoutes } from './clarify.route.js'
import { registerConfigRoutes } from './config.route.js'
import { registerCredentialsRoutes } from './credential.route.js'
import { registerEventListenerRoutes } from './event-listener.route.js'
import { registerGovernanceRoutes } from './governance.route.js'
import { registerGovernanceSuggestionRoutes } from './governance-suggestion.route.js'
import { registerHookServerRoutes } from './hook-server.route.js'
import { registerLogsRoutes } from './logs.route.js'
import { registerMcpCredentialRoutes } from './mcp-credential.route.js'
import { registerMcpServerRoutes } from './mcp-server.route.js'
import { registerOAuthRoutes } from './oauth.route.js'
import { registerPublicChatRoutes } from './public-chat.route.js'
import { registerReleaseNotesRoutes } from './release-notes.route.js'
import { registerRoleRoutes } from './role.route.js'
import { registerSkillRoutes } from './skill.route.js'
import { registerSystemRoutes } from './system.route.js'
import { registerTokenAuditRoutes } from './token-audit.route.js'
import { registerTraceabilityRoutes } from './traceability.route.js'
import { registerTraceabilityParticipantRoutes } from './traceability-participant.route.js'
import { registerUserRoutes } from './user.route.js'

/**
 * Initializes the registry by calling all registration functions.
 * This must be called before creating routers or starting the MCP server.
 */
export function initializeRegistry(): void {
	registerAuthRoutes()
	registerUserRoutes()
	registerRoleRoutes()
	registerAgentRoutes()
	registerAgentGroupRoutes()
	registerMcpServerRoutes()
	registerOAuthRoutes()
	registerChatRoutes()
	registerPublicChatRoutes()
	registerMcpCredentialRoutes()
	registerSkillRoutes()
	registerTraceabilityRoutes()
	registerTraceabilityParticipantRoutes()
	registerLogsRoutes()
	registerHookServerRoutes()
	registerEventListenerRoutes()
	registerConfigRoutes()
	registerAiAssistRoutes()
	registerGovernanceRoutes()
	registerGovernanceSuggestionRoutes()
	registerCredentialsRoutes()
	registerReleaseNotesRoutes()
	registerTokenAuditRoutes()
	registerSystemRoutes()
	registerClarifyRoutes()
}
