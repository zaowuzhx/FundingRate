import { configs } from "@/config";

export function getSocialProviders() {
  const providers: any = {};

  if (true) {
    providers.google = {
      clientId: configs.googleClientId,
      clientSecret: configs.googleClientSecret,
    };
  }

  if (true) {
    providers.github = {
      clientId: configs.githubClientId,
      clientSecret: configs.githubClientSecret,
    };
  }

  return providers;
}
