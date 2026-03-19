import { registerAgentRoutes } from "./agent.route.js";
import { registerAuthRoutes } from "./auth.route.js";
import { registerUserRoutes } from "./user.route.js";
import { registerRoleRoutes } from "./role.route.js";
import { registerMcpServerRoutes } from "./mcp-server.route.js";
import { registry } from "@applicationService/registry.service.js";

/**
 * Initializes the registry by calling all registration functions.
 * This must be called before creating routers or starting the MCP server.
 */
export function initializeRegistry(): void {
	registerAuthRoutes();
	registerUserRoutes();
	registerRoleRoutes();
	registerAgentRoutes();
	registerMcpServerRoutes();
	// console.log(
	// 	`📝 Registry initialized with ${registry.getRoutes().length} routes`,
	// );
}
