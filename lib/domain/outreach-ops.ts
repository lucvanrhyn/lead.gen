import { ApprovalStatus, ExternalSyncStatus } from "@prisma/client";

type QueueLikeItem = {
  approvalStatus: ApprovalStatus;
  gmailSyncStatus: ExternalSyncStatus;
  sheetSyncStatus: ExternalSyncStatus;
};

export function deriveApprovalQueueSummary(items: QueueLikeItem[]) {
  return {
    pendingApprovalCount: items.filter(
      (item) => item.approvalStatus === ApprovalStatus.PENDING_APPROVAL,
    ).length,
    approvedCount: items.filter((item) => item.approvalStatus === ApprovalStatus.APPROVED).length,
    syncedDraftCount: items.filter(
      (item) => item.gmailSyncStatus === ExternalSyncStatus.SYNCED,
    ).length,
  };
}
