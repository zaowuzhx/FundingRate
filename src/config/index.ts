import "dotenv/config";
import { config } from "dotenv";

export interface Configs {
  webUrl?: string;
  databaseUrl?: string;
  databaseDriver?: string;
  databaseProvider?: string;
  betterAuthUrl?: string;
  betterAuthSecret?: string;
  googleClientId?: string;
  googleClientSecret?: string;
  githubClientId?: string;
  githubClientSecret?: string;
  resendApiKey?: string;
  adsenseCode?: string;
}

export function getConfigs() {
  const configs: Configs = {
    webUrl: "http://localhost:3000",
  };

  if (typeof window !== "undefined") {
    // browser side
    configs.webUrl = process.env.NEXT_PUBLIC_WEB_URL || window.location.href;
  } else {
    // config({ path: ".env" });
    // config({ path: ".env.local" });
    // config({ path: ".env.development" });
    // config({ path: ".env.production" });

    // database
    configs.databaseUrl = process.env.DATABASE_URL || "";
    configs.databaseDriver = process.env.DATABASE_DRIVER || "";
    configs.databaseProvider = process.env.DATABASE_PROVIDER || "";

    // auth
    configs.betterAuthUrl = process.env.BETTER_AUTH_URL || configs.webUrl;
    configs.betterAuthSecret = process.env.BETTER_AUTH_SECRET || "";
    configs.googleClientId = process.env.GOOGLE_CLIENT_ID || "";
    configs.googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
    configs.githubClientId = process.env.GITHUB_CLIENT_ID || "";
    configs.githubClientSecret = process.env.GITHUB_CLIENT_SECRET || "";

    // email
    configs.resendApiKey = process.env.RESEND_API_KEY || "";

    // ad
    configs.adsenseCode = process.env.ADSENSE_CODE || "";
  }

  return configs;
}

export const configs = getConfigs();
