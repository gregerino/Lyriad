import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

// Next.js reads .env.local by itself, but drizzle-kit does not — without this,
// `pnpm db:migrate` sees an empty DATABASE_URL and refuses to run. loadEnvFile
// leaves already-set variables alone, so a real environment (CI, production)
// still wins over the local file.
const localEnv = path.resolve(process.cwd(), ".env.local");
if (existsSync(localEnv)) {
  process.loadEnvFile(localEnv);
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
