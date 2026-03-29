import { ApprovalStatus, ExternalSyncStatus } from "@prisma/client";

import { deriveApprovalQueueSummary } from "@/lib/domain/outreach-ops";

describe("deriveApprovalQueueSummary", () => {
  it("counts pending approvals and synced drafts separately", () => {
    expect(
      deriveApprovalQueueSummary([
        {
          approvalStatus: ApprovalStatus.PENDING_APPROVAL,
          gmailSyncStatus: ExternalSyncStatus.NOT_READY,
          sheetSyncStatus: ExternalSyncStatus.NOT_READY,
        },
        {
          approvalStatus: ApprovalStatus.APPROVED,
          gmailSyncStatus: ExternalSyncStatus.SYNCED,
          sheetSyncStatus: ExternalSyncStatus.READY,
        },
      ]),
    ).toMatchObject({
      pendingApprovalCount: 1,
      approvedCount: 1,
      syncedDraftCount: 1,
    });
  });
});
