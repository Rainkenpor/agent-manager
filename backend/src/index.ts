import { envs } from './envs.js'
import express from 'express'
import { createServer } from 'node:http'
import cors from 'cors'
import passport from 'passport'
import history from 'connect-history-api-fallback'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import 'reflect-metadata'

import { initializeRegistry } from './application/routes/index.js'
import { registerMCPRoutes } from './application/routes/mcp.route.js'
import { McpOAuthService } from './infra/service/mcp-oauth.service.js'
import { serviceScheduler } from './application/services/scheduler.service.js'
import { logger } from './infra/service/logger.service.js'
import { container } from './application/container.js'
import { configurePassport } from './infra/service/passport.service.js'
import { registerServerRoutes } from '@application/routes/server.router.js'
import { mcpExternalManager } from '@infra/service/mcp-external.js'
import { providerAuthService } from '@infra/service/provider-auth.service.js'

const API_PORT = envs.SERVER_PORT
const UI_PATH = join(process.cwd(), '/frontend/dist')
const UI_BASE_PATH = process.env.UI_BASE_PATH || '/'

// extraer parametros
const isUI = process.argv.includes('--ui')

async function startServers() {
	console.log('🚀 Starting Agent-Manager Servers...\n')

	// ==========================================
	// 1. Initialize Database
	// ==========================================
	console.log('📦 Initializing database...', envs.SERVER_DB_DIALECT)
	const { AppDataSource } = await import('./infra/db/database.js')
	await AppDataSource.initialize()
	console.log('✅ Database initialized')
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
	// 4. Create Express App
	// ==========================================
	const apiApp = express()

	const mcpCors = cors({
		origin: '*',
		allowedHeaders: ['Content-Type', 'mcp-session-id'],
		exposedHeaders: ['mcp-session-id']
	})

	// Middleware
	apiApp.use(cors())
	// max upload size - debe ir ANTES de otros parsers
	apiApp.use(express.json({ limit: '50mb' }))
	apiApp.use(express.urlencoded({ limit: '50mb', extended: true }))
	// Initialize Passport
	apiApp.use(passport.initialize())

	// ==========================================
	// 5. Setup Servers Routes
	// ==========================================
	console.log('🤖 Setting up servers...')

	// API Routes (Normal Server)
	apiApp.use(UI_BASE_PATH, registerServerRoutes(mcpOAuthService))

	// MCP Routes
	apiApp.use(`${UI_BASE_PATH}/mcp`, mcpCors, registerMCPRoutes(mcpOAuthService))

	// Well-known discovery so MCP clients can find the auth server
	apiApp.get(`${UI_BASE_PATH}/.well-known/oauth-protected-resource`, mcpCors, (req, res) => {
		const baseUrl = process.env.VITE_BASE_URL || '/agent-manager/'
		const base = `${req.protocol}://${req.hostname}${baseUrl}`
		res.json(mcpOAuthService.getProtectedResourceMetadata(base, base))
	})
	apiApp.get(`${UI_BASE_PATH}/.well-known/oauth-authorization-server`, mcpCors, (req, res) => {
		const baseUrl = process.env.VITE_BASE_URL || '/agent-manager/'
		const base = `${req.protocol}://${req.hostname}${baseUrl}`
		res.json(mcpOAuthService.getAuthorizationServerMetadata(base))
	})

	// ==========================================
	// 6. Serve Static UI (Only on API Server)
	// ==========================================
	if (isUI && existsSync(UI_PATH)) {
		console.log(`📁 Serving UI from: ${UI_PATH} at base path: ${UI_BASE_PATH}`)
		const uiStatic = express.static(UI_PATH)
		apiApp.use(UI_BASE_PATH, uiStatic)

		apiApp.use(UI_BASE_PATH, history())

		apiApp.use(UI_BASE_PATH, uiStatic)
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

	// ==========================================
	// 8. Start Server
	// ==========================================

	const apiHttpServer = createServer(apiApp)

	apiHttpServer.listen(API_PORT, () => {
		console.log('')
		console.log('═════════════════════════════════════════════════════════════════════')
		console.log(`✅ Agent-Manager Server running on http://localhost:${API_PORT}`)
		console.log('═════════════════════════════════════════════════════════════════════')
		console.log('')
		console.log('Endpoints:')
		if (isUI) {
			console.log(`  📄 UI:        http://localhost:${API_PORT}${UI_BASE_PATH}`)
		}
		console.log(`  🔌 API:       http://localhost:${API_PORT}${UI_BASE_PATH === '/' ? '' : UI_BASE_PATH}/api/projects`)
		console.log(`  🔌 Socket.IO: http://localhost:${API_PORT} (authenticated)`)
		console.log(`  🤖 MCP:       http://localhost:${API_PORT}${UI_BASE_PATH === '/' ? '' : UI_BASE_PATH}/mcp (Streamable HTTP)`)
		console.log(`  📋 MCP Tools: http://localhost:${API_PORT}${UI_BASE_PATH === '/' ? '' : UI_BASE_PATH}/mcp/tools`)
		console.log(`  📝 Prompts:   http://localhost:${API_PORT}${UI_BASE_PATH === '/' ? '' : UI_BASE_PATH}/mcp/prompts`)
		console.log(
			`  🔐 OAuth:     http://localhost:${API_PORT}${UI_BASE_PATH === '/' ? '' : UI_BASE_PATH}/.well-known/oauth-authorization-server`
		)
		console.log('')
		logger.info(`Server started on port ${API_PORT}`)
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
	container.mcpServerRepository
		.findAll()
		.then((servers) => mcpExternalManager.initializeFromDatabase(servers))
		.then(() => {
			console.log('✅ MCP External Manager initialized successfully')
		})
		.catch((err) => {
			console.error('⚠️  MCP External Manager failed to initialize:', err.message)
		})

	// ==========================================
	// 8.6. Hook Dispatcher Initialization
	// ==========================================
	console.log('🪝 Initializing Hook Dispatcher in background...')
	container.hookDispatcher
		.initializeAll()
		.then(() => {
			console.log('✅ Hook Dispatcher initialized successfully')
		})
		.catch((err) => {
			console.error('⚠️  Hook Dispatcher failed to initialize:', err.message)
		})

	// ==========================================
	// 8.7. Event Listener Executor Initialization
	// ==========================================
	console.log('📡 Initializing Event Listener Executor...')
	container.eventListenerExecutor
		.initialize()
		.then(() => {
			console.log('✅ Event Listener Executor initialized successfully')
		})
		.catch((err) => {
			console.error('⚠️  Event Listener Executor failed to initialize:', err.message)
		})

	// ==========================================
	// 9. Setup Scheduled Services
	// ==========================================
	console.log('⏰ Setting up scheduled services...')
	serviceScheduler.chain({
		name: 'openai-provider-token-validation',
		handler: async () => {
			await providerAuthService.validateScheduledProviders()
		},
		interval: 2 * 60 * 60 * 1000,
		runOnStart: true,
		delay: 10 * 1000,
		enabled: true
	})

	serviceScheduler.startAll()

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
