"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

import { type ApprovalQueueItem, type ApprovalQueueSummary } from "@/lib/leads/view-models";

export function ApprovalQueue({
  summary,
  items,
  workspaceConnected,
}: {
  summary: ApprovalQueueSummary;
  items: ApprovalQueueItem[];
  workspaceConnected: boolean;
}) {
  const router = useRouter();
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAction(
    draftId: string,
    action: "approve" | "reject" | "create-gmail-draft" | "sync-google-sheet",
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
    <section className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.92)] p-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-serif text-xs uppercase tracking-[0.22em] text-tan">
              Approval queue
            </p>
            <h2 className="mt-2 font-display text-3xl text-cream">
              Review generated outreach before handoff
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-[rgba(245,235,212,0.72)]">
            <QueueBadge label="Pending approval" value={summary.pendingApprovalCount} />
            <QueueBadge label="Approved" value={summary.approvedCount} />
            <QueueBadge label="Gmail synced" value={summary.syncedDraftCount} />
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-[rgba(210,180,140,0.18)] p-5 text-sm text-[rgba(245,235,212,0.68)]">
            No generated drafts are waiting for review yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {items.map((item) => (
              <article
                key={item.draftId}
                className="rounded-[1.5rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(255,255,255,0.03)] p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <p className="font-display text-2xl text-cream">{item.companyName}</p>
                    <p className="text-sm text-[rgba(245,235,212,0.72)]">
                      {item.contactName ? `${item.contactName} • ` : ""}
                      {item.emailSubject}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em]">
                      <span className="rounded-full bg-[rgba(139,105,20,0.16)] px-3 py-1 text-tan">
                        {item.approvalStatus.replaceAll("_", " ")}
                      </span>
                      <span className="rounded-full border border-[rgba(210,180,140,0.12)] px-3 py-1 text-[rgba(245,235,212,0.72)]">
                        Gmail {item.gmailSyncStatus.toLowerCase().replaceAll("_", " ")}
                      </span>
                      <span className="rounded-full border border-[rgba(210,180,140,0.12)] px-3 py-1 text-[rgba(245,235,212,0.72)]">
                        Sheets {item.sheetSyncStatus.toLowerCase().replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>

                  <Link
                    className="inline-flex items-center justify-center rounded-full border border-[rgba(210,180,140,0.16)] px-5 py-3 text-sm text-cream transition hover:bg-[rgba(255,255,255,0.04)]"
                    href={`/leads/${item.leadId}`}
                  >
                    Open lead
                  </Link>
                  {item.approvalStatus === "PENDING_APPROVAL" ? (
                    <div className="flex gap-2">
                      <button
                        className="rounded-full bg-cream px-4 py-3 text-sm font-semibold text-[#120f0c] disabled:opacity-60"
                        disabled={pendingDraftId === item.draftId}
                        onClick={() => handleAction(item.draftId, "approve")}
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="rounded-full border border-[rgba(210,180,140,0.16)] px-4 py-3 text-sm text-cream disabled:opacity-60"
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
                        className="rounded-full bg-cream px-4 py-3 text-sm font-semibold text-[#120f0c] disabled:opacity-60"
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
                        className="rounded-full border border-[rgba(210,180,140,0.16)] px-4 py-3 text-sm text-cream disabled:opacity-60"
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
    <div className="rounded-[1rem] border border-[rgba(210,180,140,0.12)] px-4 py-3">
      <p className="font-serif text-[11px] uppercase tracking-[0.2em] text-tan">{label}</p>
      <p className="mt-2 font-display text-2xl text-cream">{value}</p>
    </div>
  );
}
