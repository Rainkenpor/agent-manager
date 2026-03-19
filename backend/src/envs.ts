import fs from "node:fs";
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: ["../.env", ".env"] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const VITE_SERVER_URL = process.env.VITE_SERVER_URL || "http://localhost:3001";
const VITE_SERVER_API_PATH = process.env.VITE_SERVER_API_PATH || "/api";

const SERVER_PORT = process.env.SERVER_PORT || 3001;
const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
const SERVER_API_PATH = process.env.SERVER_API_PATH || "/api";
const SERVER_DATA_PATH = process.env.SERVER_DATA_PATH || "./data";

// Agent Model
const AGENT_MODEL = process.env.AGENT_MODEL || "";
const AGENT_BASE_URL = process.env.AGENT_BASE_URL || null;
const AGENT_KEY = process.env.AGENT_KEY || "";

// MCP
const MCP_PORT = process.env.MCP_PORT || 3002;

// Azure AD OAuth
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || "";
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || "";
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || "";
const AZURE_REDIRECT_URI =
	process.env.AZURE_REDIRECT_URI ||
	"http://localhost:3200/api/auth/azure/callback";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Server DB Path
const SERVER_DB_PATH = `${SERVER_DATA_PATH}/agent-manager.db`;
const SERVER_REPOS_PATH = `${SERVER_DATA_PATH}/repos`;
const SERVER_AUTH_PATH = `${SERVER_DATA_PATH}/auth`;

export const envs = {
	VITE_SERVER_URL,
	VITE_SERVER_API_PATH,

	SERVER_PORT,
	SERVER_URL,
	SERVER_API_PATH,
	SERVER_DB_PATH,
	SERVER_REPOS_PATH,
	SERVER_AUTH_PATH,

	MCP_PORT,

	AGENT_BASE_URL,
	AGENT_KEY,
	AGENT_MODEL,

	AZURE_CLIENT_ID,
	AZURE_CLIENT_SECRET,
	AZURE_TENANT_ID,
	AZURE_REDIRECT_URI,
	FRONTEND_URL,
};
