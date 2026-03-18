import { z, type ZodRawShape } from "zod";
import type { RegisteredRoute } from "@application/interfaces/route.interface.js";
import type { IAgentServiceExecute } from "@domain/entities/agent.entity.js";
import { registry } from "@applicationService/registry.service.js";
import nodePath from "node:path";
import fs from "node:fs";
import { agentLogger } from "../service/logger.service.js";
import type { mcpExternalManager } from "./mcp-external.js";

interface Tool {
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

/** Resolve a path — absolute paths pass through, relative ones are joined to basePath */
function resolvePath(basePath: string, filePath: string): string {
	if (nodePath.isAbsolute(filePath)) return filePath;
	return nodePath.join(basePath, filePath);
}

/** Minimalistic glob: resolves files matching a simple pattern with wildcards */
function walkFiles(
	dir: string,
	pattern: string,
	results: string[],
	maxResults: number,
	skipDirs: string[] = ["node_modules", ".git", "dist", "build"],
): void {
	if (!fs.existsSync(dir) || results.length >= maxResults) return;

	const parts = pattern.split("/");
	const head = parts[0];
	const tail = parts.slice(1).join("/");

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}

	for (const entry of entries) {
		if (results.length >= maxResults) break;
		if (entry.isDirectory() && skipDirs.includes(entry.name)) continue;

		const fullPath = nodePath.join(dir, entry.name);

		if (head === "**") {
			// Descend into subdirectory
			if (entry.isDirectory()) {
				walkFiles(fullPath, pattern, results, maxResults, skipDirs);
			}
			// Also try matching the rest of the pattern at current level
			if (tail) {
				walkFiles(dir, tail, results, maxResults, skipDirs);
			} else if (entry.isFile()) {
				results.push(fullPath);
			}
		} else {
			const regex = new RegExp(
				`^${head
					.replace(/[.+^${}()|[\]\\]/g, "\\$&")
					.replace(/\*/g, ".*")
					.replace(/\?/g, ".")}$`,
			);
			if (regex.test(entry.name)) {
				if (tail) {
					if (entry.isDirectory()) {
						walkFiles(fullPath, tail, results, maxResults, skipDirs);
					}
				} else if (entry.isFile()) {
					results.push(fullPath);
				}
			}
		}
	}
}

/** Search for text/regex in files recursively */
function grepDirectory(
	dir: string,
	pattern: string,
	includePattern: string | undefined,
	isRegex: boolean,
	results: string[],
	maxResults: number,
	skipDirs = ["node_modules", ".git", "dist", "build", ".opencode"],
): void {
	if (!fs.existsSync(dir) || results.length >= maxResults) return;

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return;
	}

	const regex = isRegex
		? new RegExp(pattern, "i")
		: new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

	const includeRegex = includePattern
		? new RegExp(
				`^${includePattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
				"i",
			)
		: null;

	for (const entry of entries) {
		if (results.length >= maxResults) break;
		const fullPath = nodePath.join(dir, entry.name);

		if (entry.isDirectory()) {
			if (skipDirs.includes(entry.name)) continue;
			grepDirectory(
				fullPath,
				pattern,
				includePattern,
				isRegex,
				results,
				maxResults,
				skipDirs,
			);
		} else if (entry.isFile()) {
			if (includeRegex && !includeRegex.test(entry.name)) continue;
			try {
				const content = fs.readFileSync(fullPath, "utf-8");
				const lines = content.split("\n");
				for (let i = 0; i < lines.length; i++) {
					if (results.length >= maxResults) break;
					if (regex.test(lines[i])) {
						results.push(`${fullPath}:${i + 1}: ${lines[i].trimEnd()}`);
					}
				}
			} catch {
				// Skip binary or unreadable files
			}
		}
	}
}

/** Invoke a registered MCP tool via the in-process registry */
async function callRegisteredTool(
	toolName: string,
	params: Record<string, unknown>,
): Promise<string> {
	const routes = registry.getRoutes();
	const route = routes.find(
		(r) =>
			r.useBy?.includes("mcp") &&
			(r.toolName === toolName ||
				r.toolName === `clarify_${toolName}` ||
				toolName === `clarify_${r.toolName}`),
	);

	if (!route?.handler) {
		const available = routes
			.filter((r) => r.toolName && r.useBy?.includes("mcp"))
			.map((r) => r.toolName)
			.join(", ");
		return `MCP tool '${toolName}' not found. Available: ${available}`;
	}

	try {
		const result = await route.handler({
			input: params as never,
			context: {
				req: {} as import("express").Request,
				res: {} as import("express").Response,
				next: (() => {}) as import("express").NextFunction,
			},
			oauthService: null as never,
		});
		return JSON.stringify(result, null, 2);
	} catch (err) {
		return `MCP tool error: ${err instanceof Error ? err.message : String(err)}`;
	}
}

/** Tool definitions for function-calling */
export function buildToolDefinitions(
	mcpExternal?: typeof mcpExternalManager,
	allowedTools?: Set<string>,
): Tool[] {
	const mcpRoutes = registry
		.getRoutes()
		.filter((r) => r.useBy?.includes("mcp"));

	const baseTools: Tool[] = [
		{
			type: "function",
			function: {
				name: "read_file",
				description:
					"Read the full contents of a file in the project directory.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description:
								"Path to the file (relative to project dir or absolute).",
						},
					},
					required: ["path"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "list_directory",
				description: "List files and sub-directories in a directory.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description:
								"Directory path (relative to project dir or absolute). Defaults to project root.",
						},
					},
					required: [],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "write_file",
				description: "Write or overwrite a file with the given content.",
				parameters: {
					type: "object",
					properties: {
						path: {
							type: "string",
							description: "File path (relative to project dir or absolute).",
						},
						content: {
							type: "string",
							description: "Content to write.",
						},
					},
					required: ["path", "content"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "search_files",
				description:
					"Find files matching a glob pattern (e.g. **/*.ts, src/**/*.sql).",
				parameters: {
					type: "object",
					properties: {
						pattern: {
							type: "string",
							description: "Glob pattern.",
						},
						base_path: {
							type: "string",
							description:
								"Base directory to search (optional, defaults to project root).",
						},
					},
					required: ["pattern"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "grep_search",
				description:
					"Search for a text pattern or regex across files in the project.",
				parameters: {
					type: "object",
					properties: {
						pattern: {
							type: "string",
							description: "Text or regex to search for.",
						},
						path: {
							type: "string",
							description:
								"Directory or file to search in (optional, defaults to project root).",
						},
						include: {
							type: "string",
							description: "File name pattern to include (e.g. *.ts, *.sql).",
						},
						is_regex: {
							type: "boolean",
							description: "Whether pattern is a regex (default false).",
						},
					},
					required: ["pattern"],
				},
			},
		},
		{
			type: "function",
			function: {
				name: "spawn_subagent",
				description:
					"Spawn a specialised sub-agent to complete a focused documentation task. The sub-agent runs in the same project directory with its own instructions and tool access.",
				parameters: {
					type: "object",
					properties: {
						agent_type: {
							type: "string",
							description:
								"Sub-agent identifier matching a .md file in .opencode/agent/ or the server agent directory (e.g. 'analyzer', 'business-rules', 'diagrams', 'examples', 'technical-concepts', 'pending', 'commits').",
						},
						query: {
							type: "string",
							description: "Detailed task for the sub-agent.",
						},
						artifacts: {
							type: "array",
							description:
								"Optional files to provide as context to the sub-agent.",
							items: {
								type: "object",
								properties: {
									name: { type: "string" },
									content: { type: "string" },
								},
								required: ["name", "content"],
							},
						},
					},
					required: ["agent_type", "query"],
				},
			},
		},
	];

	const mcpTools: Tool[] = mcpRoutes
		.filter((r) => r.toolName && r.toolDescription && r.inputSchema)
		.map((r) => {
			const zodSchema =
				r.inputSchema instanceof z.ZodObject
					? r.inputSchema
					: z.object(r.inputSchema as ZodRawShape);
			const jsonSchema = z.toJSONSchema(zodSchema) as Record<string, unknown>;
			// Remove top-level $schema key not needed by LLM APIs
			delete jsonSchema["$schema"];
			return {
				type: "function" as const,
				function: {
					name: r.toolName as string,
					description: r.toolDescription as string,
					parameters: jsonSchema,
				},
			};
		});

	const externalMcpTools: Tool[] = mcpExternal
		? (mcpExternal.getTools() as Tool[])
		: [];

	if (allowedTools && allowedTools.size > 0) {
		const filterBaseTools = baseTools.filter((t) =>
			allowedTools.has(t.function.name),
		);

		const filteredMcp = mcpTools.filter((t) =>
			allowedTools.has(`clarify_${t.function.name}`),
		);
		const filteredExternal = externalMcpTools.filter((t) =>
			allowedTools.has(t.function.name),
		);
		return [...filterBaseTools, ...filteredMcp, ...filteredExternal];
	}

	return [...baseTools, ...mcpTools, ...externalMcpTools];
}

/** Execute a single tool call and return a string result */
export async function executeToolCall(
	newAgentService: () => any,
	toolName: string,
	args: Record<string, unknown>,
	basePath: string,
	originalParams: IAgentServiceExecute,
	mcpExternal?: typeof mcpExternalManager,
): Promise<string> {
	try {
		switch (toolName) {
			case "read_file": {
				const target = resolvePath(basePath, args.path as string);
				if (!fs.existsSync(target)) return `Error: File not found: ${target}`;
				const content = fs.readFileSync(target, "utf-8");
				return content.length > 80_000
					? `${content.slice(0, 80_000)}\n…[truncated — file has ${content.length} chars]`
					: content;
			}

			case "list_directory": {
				const target = resolvePath(basePath, (args.path as string) || ".");
				if (!fs.existsSync(target))
					return `Error: Directory not found: ${target}`;
				const entries = fs.readdirSync(target, { withFileTypes: true });
				return entries
					.map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
					.join("\n");
			}

			case "write_file": {
				const target = resolvePath(basePath, args.path as string);
				fs.mkdirSync(nodePath.dirname(target), { recursive: true });
				fs.writeFileSync(target, args.content as string, "utf-8");
				return `Written: ${target}`;
			}

			case "search_files": {
				const searchBase = args.base_path
					? resolvePath(basePath, args.base_path as string)
					: basePath;
				const found: string[] = [];
				walkFiles(searchBase, args.pattern as string, found, 200);
				if (found.length === 0) return "No files found matching the pattern";
				return found.map((f) => nodePath.relative(basePath, f)).join("\n");
			}

			case "grep_search": {
				const searchDir = args.path
					? resolvePath(basePath, args.path as string)
					: basePath;
				const matches: string[] = [];
				grepDirectory(
					searchDir,
					args.pattern as string,
					args.include as string | undefined,
					(args.is_regex as boolean) ?? false,
					matches,
					100,
				);
				if (matches.length === 0) return "No matches found";
				return matches
					.map((m) => m.replace(basePath + nodePath.sep, ""))
					.join("\n");
			}

			case "spawn_subagent": {
				const subType = args.agent_type as string;
				agentLogger.info(`[InternalAgent] Spawning sub-agent: ${subType}`);
				const newAgentFactory = newAgentService();
				if (typeof newAgentFactory !== "function") {
					return `Error: spawn_subagent requires a newAgentService factory bound via .bind()`;
				}
				const subService = newAgentFactory();
				const subResult = await subService.executeAgent({
					dirPath: originalParams.dirPath,
					agentType: subType as IAgentServiceExecute["agentType"],
					query: args.query as string,
					artifacts: args.artifacts as
						| { name: string; content: string }[]
						| undefined,
				});
				return `Sub-agent '${subType}' completed.\n${typeof subResult === "string" ? subResult : ""}`;
			}

			default:
				// Comprobar primero si es una herramienta MCP externa
				if (mcpExternal?.isMcpTool(toolName)) {
					return await mcpExternal.callTool(toolName, args);
				}
				return await callRegisteredTool(toolName, args);
		}
	} catch (err) {
		return `Error in tool '${toolName}': ${err instanceof Error ? err.message : String(err)}`;
	}
}
