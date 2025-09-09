import { createAuthClient } from "better-auth/react";
import { configs } from "@/config";

export const authClient = createAuthClient({
  baseURL: configs.betterAuthUrl,
  secret: configs.betterAuthSecret,
});

export const { signIn, signUp, signOut, useSession } = authClient;
