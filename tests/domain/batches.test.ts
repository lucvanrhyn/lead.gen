import { deriveBatchStatusSummary } from "@/lib/domain/batches";

describe("deriveBatchStatusSummary", () => {
  it("marks a batch partial when some companies fail and others complete", () => {
    expect(
      deriveBatchStatusSummary([
        { status: "SUCCEEDED" },
        { status: "FAILED" },
      ]),
    ).toMatchObject({
      status: "PARTIAL",
      completedCompanies: 1,
      failedCompanies: 1,
      totalCompanies: 2,
    });
  });

  it("marks a batch running when some companies are complete and others are still pending", () => {
    expect(
      deriveBatchStatusSummary([
        { status: "SUCCEEDED" },
        { status: "PENDING" },
      ]),
    ).toMatchObject({
      status: "RUNNING",
      completedCompanies: 1,
      failedCompanies: 0,
      totalCompanies: 2,
    });
  });
});
