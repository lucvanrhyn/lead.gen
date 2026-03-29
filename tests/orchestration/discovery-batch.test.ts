import { JobStatus } from "@prisma/client";
import { vi } from "vitest";

import { runDiscoveryBatchPipeline } from "@/lib/orchestration/discovery-batch";

describe("runDiscoveryBatchPipeline", () => {
  it("continues the batch when one company pipeline fails", async () => {
    const runCompanyPipeline = vi
      .fn()
      .mockResolvedValueOnce({ status: JobStatus.SUCCEEDED })
      .mockResolvedValueOnce({ status: JobStatus.FAILED, error: "apollo blocked" });

    const result = await runDiscoveryBatchPipeline(
      [{ companyId: "company-1" }, { companyId: "company-2" }],
      { runCompanyPipeline },
    );

    expect(result.status).toBe(JobStatus.PARTIAL);
    expect(result.completedCompanies).toBe(1);
    expect(result.failedCompanies).toBe(1);
  });
});
