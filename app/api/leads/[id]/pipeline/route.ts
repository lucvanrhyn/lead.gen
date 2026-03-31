import { NextResponse } from "next/server";

import { checkRateLimit, getClientIp } from "@/lib/middleware/rate-limit";
import { runCompanyFullPipeline } from "@/lib/orchestration/full-pipeline";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(
  request: Request,
  context: RouteContext<"/api/leads/[id]/pipeline">,
) {
  const ip = getClientIp(request);
  const { allowed, remaining, resetAt } = checkRateLimit(
    `leads:pipeline:${ip}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );

  if (!allowed) {
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests", retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const { id } = await context.params;
  const result = await runCompanyFullPipeline(id);

  if (result.error === "Lead not found.") {
    const response = NextResponse.json(result, { status: 404 });
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  }

  const response = NextResponse.json(result);
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}
