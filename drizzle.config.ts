import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const SERVER_DATA_PATH = process.env.SERVER_DATA_PATH || "./data";
const SERVER_DB_PATH = `${SERVER_DATA_PATH}/clarify.db`;
export default defineConfig({
	schema: "./backend/src/infra/db/schema.ts",
	out: "./backend/drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url: SERVER_DB_PATH,
	},
});
