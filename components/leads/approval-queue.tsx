"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import {
  type ApprovalQueueItem,
  type ApprovalQueueSummary,
  type CampaignAnalytics,
} from "@/lib/leads/view-models";

export function ApprovalQueue({
  summary,
  items,
  workspaceConnected,
  campaignAnalytics,
}: {
  summary: ApprovalQueueSummary;
  items: ApprovalQueueItem[];
  workspaceConnected: boolean;
  campaignAnalytics?: CampaignAnalytics;
}) {
  const router = useRouter();
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAction(
    draftId: string,
    action:
      | "approve"
      | "reject"
      | "create-gmail-draft"
      | "sync-google-sheet"
      | "refresh-gmail-thread"
      | "sync-hubspot",
  ) {
    setPendingDraftId(draftId);
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/outreach-drafts/${draftId}/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error ?? "Queue action failed.");
        }

        const nextMessage = {
          approve: "Draft approved for Gmail handoff.",
          reject: "Draft rejected.",
          "create-gmail-draft": "Gmail draft created.",
          "sync-google-sheet": "Draft synced to Google Sheets.",
          "refresh-gmail-thread": "Gmail thread refreshed.",
          "sync-hubspot": "HubSpot mirror updated.",
        } as const;

        setMessage(nextMessage[action]);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Queue action failed.");
      } finally {
        setPendingDraftId(null);
      }
    });
  }

  return (
    <section className="dashboard-panel rounded-[2rem] p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="dashboard-eyebrow">
              Approval queue
            </p>
            <h2 className="mt-2 font-display text-3xl text-[#172033]">
              Review generated outreach before handoff
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-[rgba(22,32,51,0.72)]">
            <QueueBadge label="Pending approval" value={summary.pendingApprovalCount} />
            <QueueBadge label="Approved" value={summary.approvedCount} />
            <QueueBadge label="Gmail synced" value={summary.syncedDraftCount} />
          </div>
        </div>

        {campaignAnalytics ? (
          <div className="grid gap-3 md:grid-cols-5">
            <AnalyticsBadge label="Sent" value={campaignAnalytics.sentCount} />
            <AnalyticsBadge label="Viewed" value={campaignAnalytics.viewedCount} />
            <AnalyticsBadge label="Replied" value={campaignAnalytics.repliedCount} />
            <AnalyticsBadge label="Follow-up due" value={campaignAnalytics.followUpDueCount} />
            <AnalyticsBadge label="Suppressed" value={campaignAnalytics.suppressedCount} />
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[rgba(101,122,179,0.18)] p-5 text-sm text-[rgba(22,32,51,0.68)]">
            No generated drafts are waiting for review yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <article
                key={item.draftId}
                className="dashboard-panel-soft rounded-[1.5rem] p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <p className="font-display text-2xl text-[#172033]">{item.companyName}</p>
                    <p className="text-sm text-[rgba(22,32,51,0.72)]">
                      {item.contactName ? `${item.contactName} • ` : ""}
                      {item.emailSubject}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em]">
                      <span className="dashboard-accent-pill rounded-full px-3 py-1">
                        {item.approvalStatus.replaceAll("_", " ")}
                      </span>
                      <span className="dashboard-pill rounded-full px-3 py-1">
                        Gmail {item.gmailSyncStatus.toLowerCase().replaceAll("_", " ")}
                      </span>
                      <span className="dashboard-pill rounded-full px-3 py-1">
                        Sheets {item.sheetSyncStatus.toLowerCase().replaceAll("_", " ")}
                      </span>
                      {item.suppressionReason ? (
                        <span className="rounded-full border border-[rgba(194,126,82,0.2)] px-3 py-1 text-[#b26d4c]">
                          {item.suppressionReason.replaceAll("_", " ")}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <Link
                    className="dashboard-secondary-button inline-flex items-center justify-center rounded-full px-5 py-3 text-sm transition hover:bg-white"
                    href={`/leads/${item.leadId}`}
                  >
                    Open lead
                  </Link>
                  {item.approvalStatus === "PENDING_APPROVAL" ? (
                    <div className="flex gap-2">
                      <button
                        className="dashboard-primary-button rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-60"
                        disabled={pendingDraftId === item.draftId}
                        onClick={() => handleAction(item.draftId, "approve")}
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="dashboard-secondary-button rounded-full px-4 py-3 text-sm disabled:opacity-60"
                        disabled={pendingDraftId === item.draftId}
                        onClick={() => handleAction(item.draftId, "reject")}
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                  ) : item.approvalStatus === "APPROVED" ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="dashboard-primary-button rounded-full px-4 py-3 text-sm font-semibold disabled:opacity-60"
                        disabled={
                          pendingDraftId === item.draftId ||
                          !workspaceConnected ||
                          item.gmailSyncStatus === "SYNCED"
                        }
                        onClick={() => handleAction(item.draftId, "create-gmail-draft")}
                        type="button"
                      >
                        {item.gmailSyncStatus === "SYNCED" ? "Gmail synced" : "Create Gmail draft"}
                      </button>
                      <button
                        className="dashboard-secondary-button rounded-full px-4 py-3 text-sm disabled:opacity-60"
                        disabled={
                          pendingDraftId === item.draftId ||
                          !workspaceConnected ||
                          item.sheetSyncStatus === "SYNCED"
                        }
                        onClick={() => handleAction(item.draftId, "sync-google-sheet")}
                        type="button"
                      >
                        {item.sheetSyncStatus === "SYNCED" ? "Sheets synced" : "Sync to Sheets"}
                      </button>
                      <button
                        className="dashboard-secondary-button rounded-full px-4 py-3 text-sm disabled:opacity-60"
                        disabled={
                          pendingDraftId === item.draftId ||
                          item.gmailSyncStatus !== "SYNCED" ||
                          item.draftId.startsWith("suppressed:")
                        }
                        onClick={() => handleAction(item.draftId, "refresh-gmail-thread")}
                        type="button"
                      >
                        Refresh replies
                      </button>
                      <button
                        className="dashboard-secondary-button rounded-full px-4 py-3 text-sm disabled:opacity-60"
                        disabled={
                          pendingDraftId === item.draftId ||
                          item.draftId.startsWith("suppressed:") ||
                          item.gmailSyncStatus !== "SYNCED"
                        }
                        onClick={() => handleAction(item.draftId, "sync-hubspot")}
                        type="button"
                      >
                        Sync HubSpot
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
        {message ? <p className="text-sm text-[#c8e2c0]">{message}</p> : null}
        {error ? <p className="text-sm text-[#f1b08f]">{error}</p> : null}
      </div>
    </section>
  );
}

function QueueBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-panel-soft rounded-[1rem] px-4 py-3">
      <p className="dashboard-eyebrow text-[11px]">{label}</p>
      <p className="mt-2 font-display text-2xl text-[#172033]">{value}</p>
    </div>
  );
}

function AnalyticsBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="dashboard-panel-soft rounded-[1.25rem] px-4 py-3">
      <p className="dashboard-eyebrow text-[11px]">{label}</p>
      <p className="mt-2 font-display text-xl text-[#172033]">{value}</p>
    </div>
  );
}
