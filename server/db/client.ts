import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and point it at your local Postgres (see docker-compose.yml).",
  );
}

const queryClient = postgres(connectionString);

export const db = drizzle(queryClient, { schema });
