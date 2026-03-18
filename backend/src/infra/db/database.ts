import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { envs } from "../../envs.js";

const DB_PATH = envs.SERVER_DB_PATH;
console.log("📁 Database path:", DB_PATH);
// Crear directorio si no existe
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
	mkdirSync(dbDir, { recursive: true });
}

// Crear conexión SQLite
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Crear instancia de Drizzle
export const db = drizzle(sqlite, { schema });
