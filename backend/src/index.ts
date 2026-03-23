import { envs } from './envs.js'
import express from 'express'
import { createServer } from 'node:http'
import cors from 'cors'
import passport from 'passport'
import history from 'connect-history-api-fallback'
import path, { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

import { initializeRegistry } from './application/routes/index.js'
import { registerMCPRoutes } from './application/routes/mcp.route.js'
import { McpOAuthService } from './infra/service/mcp-oauth.service.js'
import { serviceScheduler } from './application/services/scheduler.service.js'
import { logger } from './infra/service/logger.service.js'
import { container } from './application/container.js'
import { configurePassport } from './infra/service/passport.service.js'
import { registerServerRoutes } from '@application/routes/server.router.js'
import { mcpExternalManager } from '@infra/service/mcp-external.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const API_PORT = envs.SERVER_PORT
const MCP_PORT = envs.MCP_PORT
const UI_PATH = join(__dirname, '../../frontend/dist')

// extraer parametros
const isUI = process.argv.includes('--ui')

async function startServers() {
	console.log('🚀 Starting Agent-Manager Servers...\n')

	// ==========================================
	// 1. Initialize Database
	// ==========================================
	console.log('📦 Initializing database...')
	console.log('')

	// ==========================================
	// 2. Register Routes/Tools
	// ==========================================
	console.log('📝 Registering routes and tools...')
	initializeRegistry()

	// ==========================================
	// 3. Configure Passport Authentication
	// ==========================================
	console.log('🔐 Configuring authentication...')
	configurePassport(container.userRepository)

	// ==========================================
	// 3.1. Initialize MCP OAuth Service
	// ==========================================
	console.log('🔐 Initializing MCP OAuth service...')
	const mcpOAuthService = new McpOAuthService(container.userRepository)

	// ==========================================
	// 4. Create Express Apps
	// ==========================================
	const apiApp = express()
	const mcpApp = express()

	// Middleware
	apiApp.use(cors())
	mcpApp.use(cors())
	// max upload size - debe ir ANTES de otros parsers
	apiApp.use(express.json({ limit: '50mb' }))
	mcpApp.use(express.json({ limit: '50mb' }))
	apiApp.use(express.urlencoded({ limit: '50mb', extended: true }))
	mcpApp.use(express.urlencoded({ limit: '50mb', extended: true }))
	// Initialize Passport
	apiApp.use(passport.initialize())

	mcpApp.use(
		cors({
			origin: '*', // Or your specific domain
			allowedHeaders: ['Content-Type', 'mcp-session-id'],
			exposedHeaders: ['mcp-session-id'] // Crucial for the client to see the ID
		})
	)
	mcpApp.use(express.json())
	// Logging middleware

	// ==========================================
	// 5. Setup Servers Routes
	// ==========================================
	console.log('🤖 Setting up servers...')

	// API Routes (Normal Server)
	apiApp.use(registerServerRoutes(mcpOAuthService))

	// MCP Routes (MCP Server con OAuth)
	mcpApp.use('/mcp', registerMCPRoutes(mcpOAuthService))

	// Well-known discovery on MCP server so clients can find the auth server
	mcpApp.get('/.well-known/oauth-protected-resource', (req, res) => {
		const apiBase = `${req.protocol}://${req.hostname}:${API_PORT}`
		const mcpBase = `${req.protocol}://${req.hostname}:${MCP_PORT}`
		res.json(mcpOAuthService.getProtectedResourceMetadata(mcpBase, apiBase))
	})
	mcpApp.get('/.well-known/oauth-authorization-server', (req, res) => {
		const apiBase = `${req.protocol}://${req.hostname}:${API_PORT}`
		res.json(mcpOAuthService.getAuthorizationServerMetadata(apiBase))
	})

	// ==========================================
	// 6. Serve Static UI (Only on API Server)
	// ==========================================
	if (isUI && existsSync(UI_PATH)) {
		console.log(`📁 Serving UI from: ${UI_PATH}`)
		const uiStatic = express.static(UI_PATH)
		apiApp.use(uiStatic)

		apiApp.use(history())

		apiApp.use(uiStatic)
	} else if (isUI) {
		console.log('⚠️  UI build not found. Run "npm run build" in UI directory.')
	}

	// ==========================================
	// 7. Error Handlers
	// ==========================================
	const errorHandler = (err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
		logger.error('Unhandled error', {
			message: err.message,
			stack: err.stack,
			url: _req.url,
			method: _req.method
		})
		res.status(500).json({
			success: false,
			error: err.message
		})
	}

	apiApp.use(errorHandler)
	mcpApp.use(errorHandler)

	// ==========================================
	// 8. Start Servers
	// ==========================================

	// Create HTTP servers
	const apiHttpServer = createServer(apiApp)
	const mcpHttpServer = createServer(mcpApp)

	// Start API Server
	apiHttpServer.listen(API_PORT, () => {
		console.log('')
		console.log('═════════════════════════════════════════════════════════════════════')
		console.log(`✅ Agent-Manager API Server running on http://localhost:${API_PORT}`)
		console.log('═════════════════════════════════════════════════════════════════════')
		console.log('')
		console.log('Endpoints:')
		if (isUI) {
			console.log(`  📄 UI:        http://localhost:${API_PORT}/`)
		}
		console.log(`  🔌 API:       http://localhost:${API_PORT}/api/projects`)
		console.log(`  🔌 Socket.IO: http://localhost:${API_PORT} (authenticated)`)
		logger.info(`API Server started on port ${API_PORT}`)
	})

	// Start MCP Server
	mcpHttpServer.listen(MCP_PORT, () => {
		console.log('')
		console.log('═════════════════════════════════════════════════════════════════════')
		console.log(`✅ Agent-Manager MCP Server running on http://localhost:${MCP_PORT}`)
		console.log('═════════════════════════════════════════════════════════════════════')
		console.log('')
		console.log('Endpoints:')
		console.log(`  🤖 MCP:       http://localhost:${MCP_PORT}/mcp (Streamable HTTP)`)
		console.log(`  📋 MCP Tools: http://localhost:${MCP_PORT}/mcp/tools`)
		console.log(`  📝 Prompts:   http://localhost:${MCP_PORT}/mcp/prompts`)
		console.log(`  🔐 OAuth:     http://localhost:${MCP_PORT}/.well-known/oauth-authorization-server`)
		console.log('')
		logger.info(`MCP Server started on port ${MCP_PORT}`)
	})

	// ==========================================
	// 8.4. Sync agents to disk
	// ==========================================
	console.log('🤖 Syncing agents to disk...')
	container.listAgentsUseCase.execute()

	// ==========================================
	// 8.5. MCP External Manager Initialization
	// ==========================================
	console.log('🔄 Initializing MCP External Manager in background...')
	const basePath = path.resolve(__dirname, '../../')
	mcpExternalManager
		.initializeServer(basePath)
		.then(() => {
			console.log('✅ MCP External Manager initialized successfully')
		})
		.catch((err) => {
			console.error('⚠️  MCP External Manager failed to initialize:', err.message)
		})

	// ==========================================
	// 9. Setup Scheduled Services
	// ==========================================
	console.log('⏰ Setting up scheduled services...')

	// Create embedding processor service

	// Register services using chain pattern
	// serviceScheduler
	// 	.chain({
	// 		name: "embedding-processor",
	// 		handler: async () => {
	// 			await embeddingProcessorService.processAllSections();
	// 		},
	// 		delay: 30 * 1000, // 30 segundos - dar tiempo a que embeddings se inicialice
	// 		interval: 60 * 60 * 1000, // 1 hora
	// 		runOnStart: true, // Ejecutar al iniciar (después del delay)
	// 		enabled: true,
	// 	});

	// Start all enabled services (non-blocking)
	// serviceScheduler.startAll();

	// Graceful shutdown
	process.on('SIGINT', () => {
		console.log('\n🛑 Shutting down...')
		serviceScheduler.stopAll()
		process.exit(0)
	})

	process.on('SIGTERM', () => {
		console.log('\n🛑 Shutting down...')
		serviceScheduler.stopAll()
		process.exit(0)
	})
}

async function main() {
	// Modo API: Express + SSE
	await startServers()
}

main().catch(console.error)
