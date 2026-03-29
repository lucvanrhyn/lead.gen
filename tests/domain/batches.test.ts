import { deriveBatchStatusSummary } from "@/lib/domain/batches";

describe("deriveBatchStatusSummary", () => {
  it("marks a batch partial when some companies fail and others complete", () => {
    expect(
      deriveBatchStatusSummary([
        { companyId: "company-1", status: "SUCCEEDED" },
        { companyId: "company-2", status: "FAILED" },
      ]),
    ).toMatchObject({
      status: "PARTIAL",
      completedCompanies: 1,
      failedCompanies: 1,
      totalCompanies: 2,
    });
  });
});
