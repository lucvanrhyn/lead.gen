import { resolveAppUrl } from "@/lib/domain/app-url";

const DEFAULT_PROCESSING_LIMIT = 1;

type DispatchOptions = {
  cascade?: boolean;
  limit?: number;
  origin?: string;
  request?: Request;
};

function getProcessingAuthorizationHeader() {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return null;
  }

  return `Bearer ${secret}`;
}

function getProcessingUrl(options?: DispatchOptions) {
  const params = new URLSearchParams({
    limit: String(options?.limit ?? DEFAULT_PROCESSING_LIMIT),
    cascade: options?.cascade === false ? "0" : "1",
  });
  const pathname = `/api/internal/jobs/process?${params.toString()}`;

  if (options?.origin) {
    return new URL(pathname, `${options.origin}/`).toString();
  }

  return resolveAppUrl(pathname, process.env, options?.request);
}

export async function dispatchDiscoveryProcessing(options?: DispatchOptions) {
  const authorization = getProcessingAuthorizationHeader();

  if (!authorization) {
    return {
      dispatched: false,
      reason: "missing-cron-secret",
    } as const;
  }

  const response = await fetch(getProcessingUrl(options), {
    method: "GET",
    headers: {
      authorization,
    },
    cache: "no-store",
  });

  return {
    dispatched: response.ok,
    status: response.status,
  } as const;
}
