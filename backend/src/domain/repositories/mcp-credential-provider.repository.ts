/**
 * Puerto (port) para obtener las credenciales de un usuario para un servidor MCP.
 * McpExternalManager depende de esta abstracción, no de la implementación concreta.
 */
export interface IMcpCredentialProvider {
	/** Devuelve las credenciales del usuario para el servidor dado como { key: value }. */
	getCredentials(userId: string, mcpServerId: string, showValue?: boolean): Promise<Record<string, string>>
}
