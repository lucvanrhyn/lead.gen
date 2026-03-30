import { resolveAppUrl } from "@/lib/domain/app-url";

const DEFAULT_PROCESSING_LIMIT = 1;
const MAX_PROCESSING_LIMIT = 5;

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

function getProcessingLimit(limit?: number) {
  return Number.isFinite(limit) ? Math.max(1, Math.min(limit ?? DEFAULT_PROCESSING_LIMIT, MAX_PROCESSING_LIMIT)) : DEFAULT_PROCESSING_LIMIT;
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
  const limit = getProcessingLimit(options?.limit);

  if (!authorization) {
    const { processQueuedDiscoveryJobs } = await import("@/lib/jobs/worker");
    const result = await processQueuedDiscoveryJobs({ limit });

    return {
      dispatched: true,
      mode: "direct",
      claimedCount: result.claimedCount,
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
