import fs from "node:fs";
import dotenv from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: ["../.env", ".env"] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Listar archivos
const availableAgents = (
	fs.readdirSync(
		join(__dirname, "..", "..", "src", "infra", "service", "agents"),
	) || []
).map((file) => (file as string).split(".")[0]);

const VITE_SERVER_URL = process.env.VITE_SERVER_URL || "http://localhost:3001";
const VITE_SERVER_API_PATH = process.env.VITE_SERVER_API_PATH || "/api";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3001";
const SERVER_API_PATH = process.env.SERVER_API_PATH || "/api";
const SERVER_DATA_PATH = process.env.SERVER_DATA_PATH || "./data";

// Agent Model
const AGENT_MODEL = process.env.AGENT_MODEL || "";
const AGENT_BASE_URL = process.env.AGENT_BASE_URL || null;
const AGENT_KEY = process.env.AGENT_KEY || "";
const AGENT_SERVICE =
	(process.env.AGENT_SERVICE as "opencode" | "copilot" | "internal") ||
	"opencode";

// 'internal' is a built-in service and does not require a physical agent file
if (AGENT_SERVICE !== "internal" && !availableAgents.includes(AGENT_SERVICE)) {
	throw new Error(
		`Agent service ${AGENT_SERVICE} not found. Available agents: ${availableAgents.join(", ")}`,
	);
}

// AI
const CHAT_TYPE: "lmstudio" | "openai" =
	(process.env.CHAT_TYPE as "lmstudio" | "openai") || "openai";
const CHAT_MODEL = process.env.CHAT_MODEL || "gpt-3.5-turbo";

// Oracle DB Configuration
const ORACLE_USER = process.env.ORACLE_USER;
const ORACLE_PASSWORD = process.env.ORACLE_PASSWORD;
const ORACLE_HOST = process.env.ORACLE_HOST;
const ORACLE_PORT = process.env.ORACLE_PORT
	? Number.parseInt(process.env.ORACLE_PORT)
	: 1521;
const ORACLE_SERVICE_NAME = process.env.ORACLE_SERVICE_NAME;
const ORACLE_DBLINK =
	(process.env.ORACLE_DBLINK || "")
		.trim()
		.toUpperCase()
		.split(",")
		.map((link) => link.trim()) || [];

// Validate Oracle configuration
if (!ORACLE_USER || !ORACLE_PASSWORD || !ORACLE_HOST || !ORACLE_SERVICE_NAME) {
	console.warn(
		"⚠️  Oracle configuration incomplete. Oracle features will be disabled.",
	);
}

// Server DB Path
const SERVER_DB_PATH = `${SERVER_DATA_PATH}/clarify.db`;
const SERVER_REPOS_PATH = `${SERVER_DATA_PATH}/repos`;
const SERVER_AUTH_PATH = `${SERVER_DATA_PATH}/auth`;

export const envs = {
	VITE_SERVER_URL,
	VITE_SERVER_API_PATH,

	SERVER_URL,
	SERVER_API_PATH,
	SERVER_DB_PATH,
	SERVER_REPOS_PATH,
	SERVER_AUTH_PATH,

	AGENT_SERVICE,
	AGENT_BASE_URL,
	AGENT_KEY,
	AGENT_MODEL,

	CHAT_MODEL,
	CHAT_TYPE,

	// Oracle
	ORACLE_USER,
	ORACLE_PASSWORD,
	ORACLE_HOST,
	ORACLE_PORT,
	ORACLE_SERVICE_NAME,
	ORACLE_DBLINK,
};
