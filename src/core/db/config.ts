import "dotenv/config";
import { envConfigs } from "@/config";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });
config({ path: ".env.development" });
config({ path: ".env.local" });

export default defineConfig({
  out: "./src/config/db/migrations",
  schema: "./src/config/db/schema.ts",
  dialect: envConfigs.database_provider as
    | "sqlite"
    | "postgresql"
    | "mysql"
    | "turso"
    | "singlestore"
    | "gel",
  dbCredentials: {
    url: envConfigs.database_url ?? "",
  },
});
