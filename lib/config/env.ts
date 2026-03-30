type EnvSource = NodeJS.ProcessEnv;

function normalizeEnvValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isPresentEnvValue(value?: string | null) {
  return normalizeEnvValue(value) !== undefined;
}

export function getOptionalTrimmedEnv(
  name: keyof EnvSource,
  env: EnvSource = process.env,
) {
  return normalizeEnvValue(env[name]);
}

export function getRequiredTrimmedEnv(
  name: keyof EnvSource,
  env: EnvSource = process.env,
) {
  const value = getOptionalTrimmedEnv(name, env);

  if (!value) {
    throw new Error(`Missing required environment variable: ${String(name)}.`);
  }

  return value;
}

export function getRequiredUrlEnv(
  name: keyof EnvSource,
  env: EnvSource = process.env,
) {
  const value = getRequiredTrimmedEnv(name, env);

  try {
    return new URL(value).toString();
  } catch {
    throw new Error(`Environment variable ${String(name)} must be a valid absolute URL.`);
  }
}

export function getGoogleOAuthConfig(env: EnvSource = process.env) {
  return {
    clientId: getRequiredTrimmedEnv("GOOGLE_OAUTH_CLIENT_ID", env),
    clientSecret: getRequiredTrimmedEnv("GOOGLE_OAUTH_CLIENT_SECRET", env),
    redirectUri: getRequiredUrlEnv("GOOGLE_OAUTH_REDIRECT_URI", env),
  };
}
