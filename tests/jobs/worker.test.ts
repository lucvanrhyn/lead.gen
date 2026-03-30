import { EnrichmentStage, JobStatus, SourceProvider } from "@prisma/client";

const enrichmentJobFindMany = vi.fn();
const enrichmentJobUpdateMany = vi.fn();
const enrichmentJobUpdate = vi.fn();
const enrichmentJobCreateMany = vi.fn();
const batchLeadUpdate = vi.fn();
const batchLeadFindMany = vi.fn();
const leadBatchUpdate = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    enrichmentJob: {
      findMany: enrichmentJobFindMany,
      updateMany: enrichmentJobUpdateMany,
      update: enrichmentJobUpdate,
      createMany: enrichmentJobCreateMany,
    },
    batchLead: {
      update: batchLeadUpdate,
      findMany: batchLeadFindMany,
    },
    leadBatch: {
      update: leadBatchUpdate,
    },
  },
}));

const runCompanyFullPipeline = vi.fn();

vi.mock("@/lib/orchestration/full-pipeline", () => ({
  runCompanyFullPipeline,
}));

describe("discovery queue worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues pending discovery jobs for queued companies", async () => {
    const { enqueueDiscoveryJobs } = await import("@/lib/jobs/worker");

    const count = await enqueueDiscoveryJobs([
      { batchId: "batch-1", companyId: "company-1" },
      { batchId: "batch-1", companyId: "company-2" },
    ]);

    expect(count).toBe(2);
    expect(enrichmentJobCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          companyId: "company-1",
          provider: SourceProvider.SYSTEM,
          stage: EnrichmentStage.GOOGLE_PLACES_DISCOVERY,
          status: JobStatus.PENDING,
          attempts: 0,
          requestedBy: "api.discovery.queue",
          payload: { batchId: "batch-1", companyId: "company-1" },
          runAt: expect.any(Date),
        }),
        expect.objectContaining({
          companyId: "company-2",
          payload: { batchId: "batch-1", companyId: "company-2" },
        }),
      ],
    });
  });

  it("claims and completes a queued discovery job", async () => {
    enrichmentJobFindMany.mockResolvedValueOnce([
      {
        id: "job-1",
        attempts: 0,
        payload: { batchId: "batch-1", companyId: "company-1" },
        status: JobStatus.PENDING,
        createdAt: new Date("2026-03-30T10:00:00.000Z"),
        runAt: new Date("2026-03-30T10:00:00.000Z"),
      },
    ]);
    enrichmentJobUpdateMany.mockResolvedValueOnce({ count: 1 });
    runCompanyFullPipeline.mockResolvedValueOnce({ status: JobStatus.SUCCEEDED });
    batchLeadFindMany.mockResolvedValueOnce([{ status: JobStatus.SUCCEEDED }]);

    const { processQueuedDiscoveryJobs } = await import("@/lib/jobs/worker");
    const result = await processQueuedDiscoveryJobs({ limit: 1 });

    expect(result.claimedCount).toBe(1);
    expect(runCompanyFullPipeline).toHaveBeenCalledWith("company-1");
    expect(enrichmentJobUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: expect.objectContaining({
        status: JobStatus.SUCCEEDED,
        lastError: null,
        runAt: null,
      }),
    });
    expect(batchLeadUpdate).toHaveBeenCalledWith({
      where: {
        batchId_companyId: {
          batchId: "batch-1",
          companyId: "company-1",
        },
      },
      data: {
        status: JobStatus.SUCCEEDED,
        lastError: null,
      },
    });
    expect(leadBatchUpdate).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data: {
        status: JobStatus.SUCCEEDED,
        completedCompanies: 1,
        failedCompanies: 0,
      },
    });
  });

  it("schedules a retry when a queued discovery job fails before max attempts", async () => {
    enrichmentJobFindMany.mockResolvedValueOnce([
      {
        id: "job-2",
        attempts: 1,
        payload: { batchId: "batch-9", companyId: "company-9" },
        status: JobStatus.PENDING,
        createdAt: new Date("2026-03-30T10:00:00.000Z"),
        runAt: new Date("2026-03-30T10:00:00.000Z"),
      },
    ]);
    enrichmentJobUpdateMany.mockResolvedValueOnce({ count: 1 });
    runCompanyFullPipeline.mockResolvedValueOnce({
      status: JobStatus.FAILED,
      error: "apollo blocked",
    });
    batchLeadFindMany.mockResolvedValueOnce([{ status: JobStatus.FAILED }]);

    const { processQueuedDiscoveryJobs } = await import("@/lib/jobs/worker");
    const result = await processQueuedDiscoveryJobs({ limit: 1 });

    expect(result.processed[0]).toMatchObject({
      jobId: "job-2",
      companyId: "company-9",
      batchId: "batch-9",
      status: JobStatus.FAILED,
      retryScheduled: true,
      error: "apollo blocked",
    });
    expect(enrichmentJobUpdate).toHaveBeenCalledWith({
      where: { id: "job-2" },
      data: expect.objectContaining({
        status: JobStatus.FAILED,
        lastError: "apollo blocked",
        runAt: expect.any(Date),
        resultSummary: expect.objectContaining({
          batchId: "batch-9",
          companyId: "company-9",
          retryScheduled: true,
        }),
      }),
    });
  });
});
