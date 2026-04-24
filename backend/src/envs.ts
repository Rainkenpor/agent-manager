import dotenv from 'dotenv'
dotenv.config({ path: ['../.env', '.env'] })

const VITE_SERVER_URL = process.env.VITE_SERVER_URL || 'http://localhost:3001'
const VITE_SERVER_API_PATH = process.env.VITE_SERVER_API_PATH || '/api'

const SERVER_PORT = process.env.SERVER_PORT || 3001
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001'
const SERVER_API_PATH = process.env.SERVER_API_PATH || '/api'
const SERVER_DATA_PATH = process.env.SERVER_DATA_PATH || './data'

// Credential encryption — required
const CREDENTIAL_ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY ?? ''
if (!CREDENTIAL_ENCRYPTION_KEY) {
	console.error('❌  CREDENTIAL_ENCRYPTION_KEY is not set. Add it to your .env file.')
	process.exit(1)
}

// Agent Model
const AGENT_MODEL = process.env.AGENT_MODEL || ''
const AGENT_BASE_URL = process.env.AGENT_BASE_URL || null
const AGENT_KEY = process.env.AGENT_KEY || ''

// MCP
const MCP_PORT = process.env.MCP_PORT || 3002

// Azure AD OAuth
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || ''
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || ''
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || ''
const AZURE_REDIRECT_URI = process.env.AZURE_REDIRECT_URI || 'http://localhost:3200/api/auth/azure/callback'
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3200'

// Server DB Path
const SERVER_DB_DIALECT = process.env.SERVER_DB_DIALECT || 'sqlite'
if (SERVER_DB_DIALECT !== 'sqlite' && SERVER_DB_DIALECT !== 'postgres') {
	console.error('❌  SERVER_DB_DIALECT is not set to "sqlite" or "postgres". Add it to your .env file.')
	process.exit(1)
}

const SERVER_DB_PATH = process.env.SERVER_DB_PATH || `${SERVER_DATA_PATH}/agent-manager.db`
const SERVER_DB_URL =
	process.env.SERVER_DB_URL ||
	`postgresql://${AZURE_CLIENT_ID}:${AZURE_CLIENT_SECRET}@${AZURE_TENANT_ID}.postgres.database.azure.com:5432/agent-manager`

const SERVER_AUTH_PATH = `${SERVER_DATA_PATH}/auth`

export const envs = {
	VITE_SERVER_URL,
	VITE_SERVER_API_PATH,
	CREDENTIAL_ENCRYPTION_KEY,

	SERVER_PORT,
	SERVER_URL,
	SERVER_API_PATH,

	SERVER_DB_DIALECT,
	SERVER_DB_PATH,
	SERVER_DB_URL,

	SERVER_AUTH_PATH,

	MCP_PORT,

	AGENT_BASE_URL,
	AGENT_KEY,
	AGENT_MODEL,

	AZURE_CLIENT_ID,
	AZURE_CLIENT_SECRET,
	AZURE_TENANT_ID,
	AZURE_REDIRECT_URI,
	FRONTEND_URL
}
