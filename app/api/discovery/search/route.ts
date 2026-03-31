import { after, NextResponse } from "next/server";
import { z } from "zod";

import { checkRateLimit, getClientIp } from "@/lib/middleware/rate-limit";
import { processQueuedDiscoveryJobs } from "@/lib/jobs/worker";
import { createDiscoveryBatch } from "@/lib/orchestration/discovery-batch";

const discoveryRequestSchema = z.object({
  industry: z.string().min(1),
  region: z.string().min(1),
  maxResults: z.number().int().min(1).max(20).optional(),
  persist: z.boolean().optional(),
  autoRunPipeline: z.boolean().optional(),
});

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const { allowed, remaining, resetAt } = checkRateLimit(
    `discovery:search:${ip}`,
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

  try {
    const json = await request.json();
    const input = discoveryRequestSchema.parse(json);

    const result = await createDiscoveryBatch(input);

    if (input.autoRunPipeline ?? true) {
      const batchSize = Math.min(input.maxResults ?? 10, 5);
      // Process jobs directly in-process after the response — avoids the HTTP
      // self-call path which can fail silently on Vercel Hobby.
      after(async () => {
        await processQueuedDiscoveryJobs({ limit: batchSize });
      });
    }

    const response = NextResponse.json(result);
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid discovery request.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Discovery failed.",
      },
      { status: 500 },
    );
  }
}
