import { NextResponse } from "next/server";

import { runCompanyFullPipeline } from "@/lib/orchestration/full-pipeline";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/leads/[id]/pipeline">,
) {
  const { id } = await context.params;
  const result = await runCompanyFullPipeline(id);

  if (result.error === "Lead not found.") {
    return NextResponse.json(result, { status: 404 });
  }

  return NextResponse.json(result);
}
