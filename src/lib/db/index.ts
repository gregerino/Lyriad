import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type DbClient = ReturnType<typeof drizzle<typeof schema>>;

let client: DbClient | null = null;

// Lazily initialized so `next build` (which loads route modules to collect
// page data) doesn't require DATABASE_URL to be set at build time.
function getDb(): DbClient {
  if (!client) {
    const sql = neon(process.env.DATABASE_URL!);
    client = drizzle(sql, { schema });
  }
  return client;
}

export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export * from "./schema";
