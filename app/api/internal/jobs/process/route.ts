import { after, NextResponse } from "next/server";

import { dispatchDiscoveryProcessing } from "@/lib/jobs/dispatch";
import { processQueuedDiscoveryJobs } from "@/lib/jobs/worker";

export const maxDuration = 60;

function isAuthorized(request: Request) {
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const limit = Number(searchParams.get("limit") ?? "1");
  const cascade = searchParams.get("cascade") !== "0";
  const result = await processQueuedDiscoveryJobs({
    limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 5)) : 1,
  });

  if (cascade && result.claimedCount > 0) {
    after(async () => {
      await dispatchDiscoveryProcessing({
        request,
        limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 5)) : 1,
      });
    });
  }

  return NextResponse.json(result);
}
