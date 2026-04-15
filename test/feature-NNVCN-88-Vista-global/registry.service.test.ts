import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { RouteToolRegistry } from "../../backend/src/application/services/registry.service.js";

// Mock the MCP SDK module
vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
	McpServer: vi.fn().mockImplementation(() => ({
		server: {},
		notificationManager: {},
		requestHandlers: new Map(),
		resources: [],
		tools: [],
		toolSpecs: [],
		prompts: [],
		undiscoveredResources: new Set(),
		undiscoveredPrompts: new Set(),
		undiscoveredTools: new Set(),
		tool: vi.fn(),
		registerPrompt: vi.fn(),
	})),
}));

// Mock the MCP OAuth service module
vi.mock("@infra/service/mcp-oauth.service.js", () => ({
	McpOAuthService: vi.fn().mockImplementation(() => ({
		getAccessToken: vi.fn().mockResolvedValue("mock-token"),
		refreshToken: vi.fn().mockResolvedValue("mock-refreshed-token"),
	})),
}));

describe("RouteToolRegistry", () => {
	let registry: RouteToolRegistry;

	beforeEach(() => {
		registry = new RouteToolRegistry();
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("register()", () => {
		it("should add a route to the routes array", () => {
			const testSchema = z.object({
				name: z.string(),
			});

			registry.register({
				useBy: ["mcp"],
				method: "GET",
				path: "/test",
				toolName: "testTool",
				toolDescription: "A test tool",
				inputSchema: testSchema,
				handler: async ({ input }) => ({ success: true, input }),
			});

			const routes = registry.getRoutes();
			expect(routes).toHaveLength(1);
			expect(routes[0]).toMatchObject({
				useBy: ["mcp"],
				method: "GET",
				path: "/test",
				toolName: "testTool",
				toolDescription: "A test tool",
			});
		});

		it("should add multiple routes correctly", () => {
			const testSchema = z.object({
				id: z.string(),
			});

			registry.register({
				useBy: ["mcp"],
				method: "GET",
				path: "/route1",
				toolName: "tool1",
				toolDescription: "First tool",
				inputSchema: testSchema,
				handler: async () => ({ result: "first" }),
			});

			registry.register({
				useBy: ["server"],
				method: "POST",
				path: "/route2",
				toolName: "tool2",
				toolDescription: "Second tool",
				inputSchema: testSchema,
				handler: async () => ({ result: "second" }),
			});

			const routes = registry.getRoutes();
			expect(routes).toHaveLength(2);
			expect(routes[0]).toMatchObject({
				path: "/route1",
				toolName: "tool1",
			});
			expect(routes[1]).toMatchObject({
				path: "/route2",
				toolName: "tool2",
			});
		});
	});

	describe("getRoutes()", () => {
		it("should return all registered routes", () => {
			const testSchema = z.object({ data: z.string() });

			registry.register({
				useBy: ["mcp"],
				method: "GET",
				path: "/users",
				toolName: "getUsers",
				toolDescription: "Get all users",
				inputSchema: testSchema,
				handler: async () => [],
			});

			registry.register({
				useBy: ["server"],
				method: "POST",
				path: "/users",
				toolName: "createUser",
				toolDescription: "Create a user",
				inputSchema: testSchema,
				handler: async () => ({}),
			});

			const routes = registry.getRoutes();
			expect(routes).toHaveLength(2);
			expect(routes.map((r) => r.path)).toContain("/users");
		});
	});

	describe("getRegisteredTools()", () => {
		it("should return tools with correct structure", () => {
			const testSchema = z.object({
				id: z.string(),
			});

			registry.register({
				useBy: ["mcp"],
				method: "GET",
				path: "/api/items/:id",
				toolName: "getItem",
				toolDescription: "Get an item by ID",
				inputSchema: testSchema,
				handler: async () => ({}),
			});

			const tools = registry.getRegisteredTools();
			expect(tools).toHaveLength(1);
			expect(tools[0]).toEqual({
				name: "getItem",
				description: "Get an item by ID",
				method: "GET",
				path: "/api/items/:id",
			});
		});

		it("should return empty array when no routes registered", () => {
			const tools = registry.getRegisteredTools();
			expect(tools).toHaveLength(0);
		});
	});

	describe("registerPrompt()", () => {
		it("should add a prompt to the prompts array", () => {
			registry.registerPrompt({
				toolName: "testPrompt",
				toolDescription: "A test prompt",
				handler: async () => ({ messages: [] }),
			});

			const routes = registry.getRoutes();
			expect(routes).toHaveLength(0);

			// We can verify prompt registration by checking applyToMcpServer behavior
			// since prompts are stored in a private array
		});
	});

	describe("applyToMcpServer()", () => {
		it('should filter routes by "mcp" useBy and call server.tool()', async () => {
			const { McpServer } = await import(
				"@modelcontextprotocol/sdk/server/mcp.js"
			);

			const mockServer = {
				tool: vi.fn(),
				registerPrompt: vi.fn(),
			};
			(McpServer as unknown as vi.Mock).mockImplementation(() => mockServer);

			const testSchema = z.object({
				name: z.string(),
			});

			registry.register({
				useBy: ["mcp"],
				method: "GET",
				path: "/mcp-route",
				toolName: "mcpTool",
				toolDescription: "MCP tool",
				inputSchema: testSchema,
				handler: async ({ input }) => ({ result: input }),
			});

			registry.register({
				useBy: ["server"],
				method: "GET",
				path: "/server-route",
				toolName: "serverTool",
				toolDescription: "Server only tool",
				inputSchema: testSchema,
				handler: async () => ({}),
			});

			registry.applyToMcpServer({
				server: mockServer as unknown as any,
				sessionId: "test-session",
			});

			// Should only call tool() once for the 'mcp' route
			expect(mockServer.tool).toHaveBeenCalledTimes(1);
			expect(mockServer.tool).toHaveBeenCalledWith(
				"mcpTool",
				"MCP tool",
				testSchema,
				expect.any(Function),
			);
		});

		it("should skip routes without toolName/toolDescription/inputSchema", async () => {
			const { McpServer } = await import(
				"@modelcontextprotocol/sdk/server/mcp.js"
			);

			const mockServer = {
				tool: vi.fn(),
				registerPrompt: vi.fn(),
			};
			(McpServer as unknown as vi.Mock).mockImplementation(() => mockServer);

			// Register a route missing required properties
			registry.register({
				useBy: ["mcp"],
				method: "GET",
				path: "/incomplete-route",
				// Missing toolName, toolDescription, inputSchema
				handler: async () => ({}),
			});

			// Register a complete route
			const testSchema = z.object({ id: z.string() });
			registry.register({
				useBy: ["mcp"],
				method: "POST",
				path: "/complete-route",
				toolName: "completeTool",
				toolDescription: "Complete tool",
				inputSchema: testSchema,
				handler: async () => ({}),
			});

			registry.applyToMcpServer({
				server: mockServer as unknown as any,
				sessionId: "test-session",
			});

			// Should only call tool() for the complete route
			expect(mockServer.tool).toHaveBeenCalledTimes(1);
			expect(mockServer.tool).toHaveBeenCalledWith(
				"completeTool",
				"Complete tool",
				testSchema,
				expect.any(Function),
			);
		});

		it("should validate input with Zod and return error on invalid input", async () => {
			const { McpServer } = await import(
				"@modelcontextprotocol/sdk/server/mcp.js"
			);

			const mockServer = {
				tool: vi.fn(),
				registerPrompt: vi.fn(),
			};
			(McpServer as unknown as vi.Mock).mockImplementation(() => mockServer);

			const testSchema = z.object({
				name: z.string().min(1, "Name is required"),
				age: z.number().positive("Age must be positive"),
			});

			registry.register({
				useBy: ["mcp"],
				method: "POST",
				path: "/validate",
				toolName: "validateTool",
				toolDescription: "Validation tool",
				inputSchema: testSchema,
				handler: async ({ input }) => ({ success: true, data: input }),
			});

			registry.applyToMcpServer({
				server: mockServer as unknown as any,
				sessionId: "test-session",
			});

			// Get the tool handler function
			const toolCall = mockServer.tool.mock.calls[0];
			const toolHandler = toolCall[3] as (args: unknown) => Promise<unknown>;

			// Call with invalid input
			const result = await toolHandler({ name: "", age: -5 });

			expect(result).toMatchObject({
				isError: true,
				content: expect.arrayContaining([
					expect.objectContaining({
						type: "text",
						text: expect.stringContaining("Validation error"),
					}),
				]),
			});
		});

		it("should call server.registerPrompt() for prompts", async () => {
			const { McpServer } = await import(
				"@modelcontextprotocol/sdk/server/mcp.js"
			);

			const mockServer = {
				tool: vi.fn(),
				registerPrompt: vi.fn(),
			};
			(McpServer as unknown as vi.Mock).mockImplementation(() => mockServer);

			registry.registerPrompt({
				toolName: "testPrompt",
				toolDescription: "A test prompt",
				handler: async () => ({
					messages: [
						{
							role: "user",
							content: { type: "text", text: "Hello" },
						},
					],
				}),
			});

			registry.applyToMcpServer({
				server: mockServer as unknown as any,
				sessionId: "test-session",
			});

			expect(mockServer.registerPrompt).toHaveBeenCalledTimes(1);
			expect(mockServer.registerPrompt).toHaveBeenCalledWith(
				"testPrompt",
				{
					title: "A test prompt",
					description: "A test prompt",
				},
				expect.any(Function),
			);
		});

		it("should execute handler with valid input and return result", async () => {
			const { McpServer } = await import(
				"@modelcontextprotocol/sdk/server/mcp.js"
			);

			const mockServer = {
				tool: vi.fn(),
				registerPrompt: vi.fn(),
			};
			(McpServer as unknown as vi.Mock).mockImplementation(() => mockServer);

			const testSchema = z.object({
				message: z.string(),
			});

			registry.register({
				useBy: ["mcp"],
				method: "POST",
				path: "/echo",
				toolName: "echoTool",
				toolDescription: "Echo tool",
				inputSchema: testSchema,
				handler: async ({ input }) => ({ echoed: input.message }),
			});

			registry.applyToMcpServer({
				server: mockServer as unknown as any,
				sessionId: "test-session",
			});

			const toolCall = mockServer.tool.mock.calls[0];
			const toolHandler = toolCall[3] as (args: unknown) => Promise<unknown>;

			const result = await toolHandler({ message: "Hello World" });

			expect(result).toMatchObject({
				content: expect.arrayContaining([
					expect.objectContaining({
						type: "text",
						text: expect.stringContaining("Hello World"),
					}),
				]),
			});
		});

		it("should handle handler errors gracefully", async () => {
			const { McpServer } = await import(
				"@modelcontextprotocol/sdk/server/mcp.js"
			);

			const mockServer = {
				tool: vi.fn(),
				registerPrompt: vi.fn(),
			};
			(McpServer as unknown as vi.Mock).mockImplementation(() => mockServer);

			const testSchema = z.object({
				shouldFail: z.boolean(),
			});

			registry.register({
				useBy: ["mcp"],
				method: "POST",
				path: "/fail",
				toolName: "failTool",
				toolDescription: "Failing tool",
				inputSchema: testSchema,
				handler: async () => {
					throw new Error("Handler execution failed");
				},
			});

			registry.applyToMcpServer({
				server: mockServer as unknown as any,
				sessionId: "test-session",
			});

			const toolCall = mockServer.tool.mock.calls[0];
			const toolHandler = toolCall[3] as (args: unknown) => Promise<unknown>;

			const result = await toolHandler({ shouldFail: true });

			expect(result).toMatchObject({
				isError: true,
				content: expect.arrayContaining([
					expect.objectContaining({
						type: "text",
						text: expect.stringContaining("Handler execution failed"),
					}),
				]),
			});
		});
	});
});
