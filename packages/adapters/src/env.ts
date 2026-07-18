/** Providers with credential-gated live access. */
export type CredentialedProvider = "elevenlabs";

const PROVIDER_ENV_VARS: Record<CredentialedProvider, string[]> = {
  elevenlabs: ["ELEVENLABS_API_KEY"],
};

export function hasCredentials(provider: CredentialedProvider): boolean {
  return PROVIDER_ENV_VARS[provider].every((name) =>
    Boolean(process.env[name]?.trim()),
  );
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `missing required environment variable ${name} — add it to .env (see .env.example)`,
    );
  }
  return value;
}
