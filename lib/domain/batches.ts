import { JobStatus } from "@prisma/client";

type BatchItemStatus = Pick<{ companyId: string; status: JobStatus }, "companyId" | "status">;

export function deriveBatchStatusSummary(items: BatchItemStatus[]) {
  const completedCompanies = items.filter((item) => item.status === JobStatus.SUCCEEDED).length;
  const failedCompanies = items.filter((item) => item.status === JobStatus.FAILED).length;
  const runningCompanies = items.filter((item) => item.status === JobStatus.RUNNING).length;
  const partialCompanies = items.filter((item) => item.status === JobStatus.PARTIAL).length;
  const totalCompanies = items.length;

  const status =
    (failedCompanies > 0 && completedCompanies > 0) || partialCompanies > 0
      ? JobStatus.PARTIAL
      : failedCompanies === totalCompanies && totalCompanies > 0
        ? JobStatus.FAILED
        : completedCompanies === totalCompanies && totalCompanies > 0
          ? JobStatus.SUCCEEDED
          : runningCompanies > 0
            ? JobStatus.RUNNING
            : JobStatus.PENDING;

  return {
    status,
    completedCompanies,
    failedCompanies,
    totalCompanies,
  };
}
