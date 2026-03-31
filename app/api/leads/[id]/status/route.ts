import { NextResponse } from "next/server";

import { db } from "@/lib/db";

type PipelineStatus = "idle" | "running" | "done" | "failed";

// Maps EnrichmentJob.status (JobStatus enum) to a simplified display value.
function mapJobStatus(status: string): "done" | "running" | "failed" | "pending" {
  switch (status) {
    case "SUCCEEDED":
    case "PARTIAL":
      return "done";
    case "RUNNING":
      return "running";
    case "FAILED":
      return "failed";
    default:
      return "pending";
  }
}

// Derives the overall pipeline status from the most recent set of jobs.
function derivePipelineStatus(
  jobs: Array<{ status: string }>,
): PipelineStatus {
  if (jobs.length === 0) return "idle";

  const statuses = jobs.map((j) => j.status);

  if (statuses.includes("RUNNING")) return "running";
  if (statuses.includes("FAILED")) return "failed";
  if (statuses.every((s) => s === "SUCCEEDED" || s === "PARTIAL")) return "done";

  return "idle";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    const company = await db.company.findUnique({
      where: { id },
      select: { id: true, updatedAt: true },
    });

    if (!company) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    // Fetch the most recent EnrichmentJob per stage for this company.
    // We group by stage and take only the latest attempt.
    const jobs = await db.enrichmentJob.findMany({
      where: { companyId: id },
      orderBy: { createdAt: "desc" },
      select: {
        stage: true,
        status: true,
        lastError: true,
        updatedAt: true,
      },
    });

    // Deduplicate — keep only the most recent job per stage.
    const seenStages = new Set<string>();
    const latestJobsPerStage = jobs.filter((job) => {
      if (seenStages.has(job.stage)) return false;
      seenStages.add(job.stage);
      return true;
    });

    const stages = latestJobsPerStage.map((job) => ({
      stage: job.stage,
      status: mapJobStatus(job.status),
      ...(job.lastError ? { error: job.lastError } : {}),
    }));

    const overallStatus = derivePipelineStatus(latestJobsPerStage);
    const mostRecentJob = jobs[0];

    return NextResponse.json({
      status: overallStatus,
      currentStage:
        overallStatus === "running"
          ? (latestJobsPerStage.find((j) => j.status === "RUNNING")?.stage ?? null)
          : null,
      stages,
      updatedAt: mostRecentJob?.updatedAt.toISOString() ?? company.updatedAt.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Status check failed." },
      { status: 500 },
    );
  }
}
