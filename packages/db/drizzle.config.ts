import { defineConfig } from "drizzle-kit";
import { DB_PATH } from "@tek/core";

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/schema/index.ts",
	out: "./drizzle",
	dbCredentials: {
		url: DB_PATH,
	},
});
