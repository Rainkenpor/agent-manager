import { registry } from "@applicationService/registry.service.js";
import { mcpExternalManager } from "@infra/service/mcp-external.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AvailableTool {
	name: string;
	description: string;
	source: "builtin" | "registry" | "external";
}

const BASE_TOOLS: AvailableTool[] = [
	{
		name: "spawn_subagent",
		description:
			"Lanza un sub-agente especializado para completar una tarea de documentación enfocada.",
		source: "builtin",
	},
];

// ── Cache para las herramientas externas ──────────────────────────────────────
let _externalCache: AvailableTool[] | null = null;
let _externalCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

async function getExternalTools(): Promise<AvailableTool[]> {
	const now = Date.now();
	if (_externalCache && now - _externalCacheTime < CACHE_TTL_MS) {
		return _externalCache;
	}

	// Busca mcp.json subiendo desde la raíz del proyecto (4 niveles arriba desde services/)
	const tools: AvailableTool[] = mcpExternalManager.getTools().map((t) => ({
		name: t.function.name,
		description: t.function.description,
		source: "external" as const,
	}));

	_externalCache = tools;
	_externalCacheTime = now;
	return tools;
}

/** Invalida el cache de herramientas externas */
export function invalidateExternalToolsCache(): void {
	_externalCache = null;
	_externalCacheTime = 0;
}

/**
 * Lista todas las herramientas disponibles para asignar a un agente:
 * - Builtin: read_file, list_directory, write_file, search_files, grep_search, spawn_subagent
 * - Registry: todas las rutas MCP registradas en el registry de la aplicación
 * - External: herramientas de servidores MCP definidos en mcp.json
 */
export async function listAvailableAgentTools(): Promise<AvailableTool[]> {
	const registryTools: AvailableTool[] = registry
		.getRoutes()
		.filter((r) => r.useBy?.includes("mcp") && r.toolName && r.toolDescription)
		.map((r) => ({
			name: `clarify_${r.toolName}`,
			description: r.toolDescription as string,
			source: "registry" as const,
		}));

	const externalTools = await getExternalTools();

	return [...BASE_TOOLS, ...registryTools, ...externalTools];
}
