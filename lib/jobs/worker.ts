import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";

import { db } from "@/lib/db";
import { deriveBatchStatusSummary } from "@/lib/domain/batches";
import { runCompanyFullPipeline } from "@/lib/orchestration/full-pipeline";

const DISCOVERY_QUEUE_REQUESTED_BY = "api.discovery.queue";
const MAX_DISCOVERY_JOB_ATTEMPTS = 3;
const DISCOVERY_QUEUE_ADVISORY_LOCK_ID = 4_047_202_630;

type DiscoveryQueuePayload = {
  batchId: string;
  companyId: string;
};

type QueueJob = {
  id: string;
  attempts: number;
  payload: unknown;
  status: JobStatus;
};

function parseDiscoveryQueuePayload(payload: unknown): DiscoveryQueuePayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  if (typeof candidate.batchId !== "string" || typeof candidate.companyId !== "string") {
    return null;
  }

  return {
    batchId: candidate.batchId,
    companyId: candidate.companyId,
  };
}

function getRetryDelayMs(attempt: number) {
  return Math.min(15 * 60 * 1000, 60_000 * 2 ** Math.max(0, attempt - 1));
}

async function refreshBatchSummary(batchId: string) {
  const items = await db.batchLead.findMany({
    where: { batchId },
    select: { status: true },
  });
  const summary = deriveBatchStatusSummary(items);

  await db.leadBatch.update({
    where: { id: batchId },
    data: {
      status: summary.status,
      completedCompanies: summary.completedCompanies,
      failedCompanies: summary.failedCompanies,
    },
  });

  return summary;
}

export async function enqueueDiscoveryJobs(
  items: Array<{ batchId: string; companyId: string }>,
) {
  if (items.length === 0) {
    return 0;
  }

  await db.enrichmentJob.createMany({
    data: items.map((item) => ({
      companyId: item.companyId,
      provider: SourceProvider.SYSTEM,
      stage: EnrichmentStage.GOOGLE_PLACES_DISCOVERY,
      status: JobStatus.PENDING,
      attempts: 0,
      requestedBy: DISCOVERY_QUEUE_REQUESTED_BY,
      payload: item,
      runAt: new Date(),
    })),
  });

  return items.length;
}

export async function claimQueuedDiscoveryJobs(limit = 5) {
  const now = new Date();
  const candidates = await db.enrichmentJob.findMany({
    where: {
      requestedBy: DISCOVERY_QUEUE_REQUESTED_BY,
      stage: EnrichmentStage.GOOGLE_PLACES_DISCOVERY,
      status: { in: [JobStatus.PENDING, JobStatus.FAILED] },
      OR: [{ runAt: null }, { runAt: { lte: now } }],
    },
    orderBy: [{ runAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });

  const claimed: QueueJob[] = [];

  for (const candidate of candidates) {
    const result = await db.enrichmentJob.updateMany({
      where: {
        id: candidate.id,
        status: candidate.status,
      },
      data: {
        status: JobStatus.RUNNING,
        attempts: {
          increment: 1,
        },
        lastError: null,
      },
    });

    if (result.count === 1) {
      claimed.push({
        id: candidate.id,
        attempts: candidate.attempts + 1,
        payload: candidate.payload,
        status: JobStatus.RUNNING,
      });
    }
  }

  return claimed;
}

export async function processQueuedDiscoveryJobs(
  input?: {
    limit?: number;
    runCompanyPipeline?: (companyId: string) => Promise<{ status: JobStatus; error?: string }>;
  },
) {
  const advisoryLock = await db.$queryRaw<Array<{ locked: boolean }>>`
    SELECT pg_try_advisory_lock(${DISCOVERY_QUEUE_ADVISORY_LOCK_ID}) AS locked
  `;
  const lockAcquired = advisoryLock[0]?.locked === true;

  if (!lockAcquired) {
    return {
      claimedCount: 0,
      processed: [],
      skippedReason: "worker-locked" as const,
    };
  }

  try {
    const jobs = await claimQueuedDiscoveryJobs(input?.limit ?? 5);
    const runCompanyPipeline =
      input?.runCompanyPipeline ??
      (async (companyId: string) => runCompanyFullPipeline(companyId));

    const processed = [];

    for (const job of jobs) {
      const payload = parseDiscoveryQueuePayload(job.payload);

      if (!payload) {
        await db.enrichmentJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            lastError: "Queue payload was invalid.",
            runAt: null,
          },
        });
        processed.push({
          jobId: job.id,
          status: JobStatus.FAILED,
          error: "Queue payload was invalid.",
        });
        continue;
      }

      try {
        const result = await runCompanyPipeline(payload.companyId);
        const shouldRetry =
          result.status === JobStatus.FAILED && job.attempts < MAX_DISCOVERY_JOB_ATTEMPTS;
        const nextRunAt = shouldRetry
          ? new Date(Date.now() + getRetryDelayMs(job.attempts))
          : null;

        await db.enrichmentJob.update({
          where: { id: job.id },
          data: {
            status: result.status,
            lastError: result.error ?? null,
            resultSummary: {
              batchId: payload.batchId,
              companyId: payload.companyId,
              retryScheduled: shouldRetry,
              ...(nextRunAt ? { nextRunAt: nextRunAt.toISOString() } : {}),
            },
            runAt: nextRunAt,
          },
        });

        await db.batchLead.update({
          where: {
            batchId_companyId: {
              batchId: payload.batchId,
              companyId: payload.companyId,
            },
          },
          data: {
            status: result.status,
            lastError: result.error ?? null,
          },
        });

        await refreshBatchSummary(payload.batchId);
        processed.push({
          jobId: job.id,
          companyId: payload.companyId,
          batchId: payload.batchId,
          status: result.status,
          retryScheduled: shouldRetry,
          error: result.error,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Queued discovery job failed.";
        const shouldRetry = job.attempts < MAX_DISCOVERY_JOB_ATTEMPTS;
        const nextRunAt = shouldRetry
          ? new Date(Date.now() + getRetryDelayMs(job.attempts))
          : null;

        await db.enrichmentJob.update({
          where: { id: job.id },
          data: {
            status: JobStatus.FAILED,
            lastError: message,
            runAt: nextRunAt,
          },
        });

        if (payload) {
          await db.batchLead.update({
            where: {
              batchId_companyId: {
                batchId: payload.batchId,
                companyId: payload.companyId,
              },
            },
            data: {
              status: JobStatus.FAILED,
              lastError: message,
            },
          });
          await refreshBatchSummary(payload.batchId);
        }

        processed.push({
          jobId: job.id,
          companyId: payload?.companyId,
          batchId: payload?.batchId,
          status: JobStatus.FAILED,
          retryScheduled: shouldRetry,
          error: message,
        });
      }
    }

    return {
      claimedCount: jobs.length,
      processed,
    };
  } finally {
    await db.$executeRaw`
      SELECT pg_advisory_unlock(${DISCOVERY_QUEUE_ADVISORY_LOCK_ID})
    `;
  }
}
