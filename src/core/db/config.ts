import { defineConfig } from "drizzle-kit";
import { configs } from "@/config";

export default defineConfig({
  out: "./src/config/db/migrations",
  schema: "./src/config/db/schema.ts",
  dialect: configs.databaseDriver as
    | "sqlite"
    | "postgresql"
    | "mysql"
    | "turso"
    | "singlestore"
    | "gel",
  dbCredentials: {
    url: configs.databaseUrl ?? "",
  },
});
