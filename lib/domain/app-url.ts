const LOCAL_APP_URL = "http://localhost:3000";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getAppBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
  request?: Request,
) {
  const configured =
    env.APP_BASE_URL?.trim() ||
    env.NEXT_PUBLIC_APP_URL?.trim() ||
    env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (configured) {
    if (configured.startsWith("http://") || configured.startsWith("https://")) {
      return trimTrailingSlash(configured);
    }

    return trimTrailingSlash(`https://${configured}`);
  }

  if (request) {
    return new URL(request.url).origin;
  }

  return LOCAL_APP_URL;
}

export function resolveAppUrl(
  pathname: string,
  env: NodeJS.ProcessEnv = process.env,
  request?: Request,
) {
  return new URL(pathname, `${getAppBaseUrl(env, request)}/`).toString();
}
