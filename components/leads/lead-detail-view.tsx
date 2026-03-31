"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  CheckCircle2,
  ChevronDown,
  Circle,
  Linkedin,
  Loader2,
  Mail,
  Newspaper,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

import { ManualReviewToggle } from "@/components/leads/manual-review-toggle";
import { PipelineActions } from "@/components/leads/pipeline-actions";
import { type LeadDetailViewModel } from "@/lib/leads/view-models";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "company", label: "Company", icon: ScanSearch },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "tech", label: "Tech", icon: Wrench },
  { id: "news", label: "News", icon: Newspaper },
  { id: "pains", label: "Pains", icon: Sparkles },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin },
  { id: "engagement", label: "Engagement", icon: Activity },
  { id: "outreach", label: "Outreach", icon: Mail },
] as const;

type TabId = (typeof tabs)[number]["id"];

// ---------------------------------------------------------------------------
// Pipeline polling types
// ---------------------------------------------------------------------------

type StageDisplayStatus = "done" | "running" | "failed" | "pending";

type PipelineStageResult = {
  stage: string;
  status: StageDisplayStatus;
  error?: string;
};

type PipelineStatusResponse = {
  status: "idle" | "running" | "done" | "failed";
  currentStage: string | null;
  stages: PipelineStageResult[];
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Polling hook — polls /api/leads/[id]/status every 2 s while active.
// Automatically stops when status reaches "done" or "failed".
// ---------------------------------------------------------------------------

function usePipelinePolling(leadId: string, active: boolean) {
  const [pollingStatus, setPollingStatus] = useState<PipelineStatusResponse | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);

  // Keep the ref in sync with the prop so the closure always sees the latest value.
  activeRef.current = active;

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    if (!activeRef.current) return;

    abortRef.current = new AbortController();

    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Status check failed.");
      }

      const data = (await response.json()) as PipelineStatusResponse;
      setPollingStatus(data);
      setPollingError(null);

      if (data.status === "done" || data.status === "failed") {
        stopPolling();
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setPollingError(err instanceof Error ? err.message : "Status check failed.");
    }

    // Schedule next tick only if still active.
    if (activeRef.current) {
      timerRef.current = setTimeout(() => {
        void poll();
      }, 2000);
    }
  }, [leadId, stopPolling]);

  useEffect(() => {
    if (active) {
      setPollingStatus(null);
      setPollingError(null);
      void poll();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [active, poll, stopPolling]);

  return { pollingStatus, pollingError, stopPolling };
}

// ---------------------------------------------------------------------------
// Stage icon helper
// ---------------------------------------------------------------------------

function StageIcon({ status }: { status: StageDisplayStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-[#37523a]" />;
    case "running":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#3d4b87]" />;
    case "failed":
      return <XCircle className="h-4 w-4 shrink-0 text-[#8c3640]" />;
    default:
      return <Circle className="h-4 w-4 shrink-0 text-[rgba(22,32,51,0.32)]" />;
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LeadDetailView({ lead }: { lead: LeadDetailViewModel }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("company");
  const [archiving, setArchiving] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelinePollingActive, setPipelinePollingActive] = useState(false);

  const { pollingStatus, pollingError } = usePipelinePolling(
    lead.company.id,
    pipelinePollingActive,
  );

  // Detect when polling finishes so we can refresh the lead data.
  const prevPollingStatus = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPollingStatus.current;
    const current = pollingStatus?.status ?? null;
    prevPollingStatus.current = current;

    if ((current === "done" || current === "failed") && prev !== current) {
      setPipelinePollingActive(false);
      router.refresh();
    }
  }, [pollingStatus, router]);

  // Determine whether the pipeline accordion should show a badge.
  const pipelineHasActivity = lead.pipeline.completedCount > 0;
  const pipelineActionRequired = lead.pipeline.stages.some(
    (s) => s.status === "FAILED" || s.status === "NOT_STARTED",
  );

  async function handleArchive() {
    setArchiving(true);
    await fetch(`/api/leads/${lead.company.id}/archive`, { method: "POST" });
    router.push("/leads");
  }

  const [engagementMessage, setEngagementMessage] = useState<string | null>(null);
  const [engagementError, setEngagementError] = useState<string | null>(null);
  const [pendingEngagementDraftId, setPendingEngagementDraftId] = useState<string | null>(null);
  const [outreachMessage, setOutreachMessage] = useState<string | null>(null);
  const [outreachError, setOutreachError] = useState<string | null>(null);
  const [pendingOutreachAction, setPendingOutreachAction] = useState<string | null>(null);

  function handleEngagement(draftId: string, eventType: "OPEN" | "CLICK" | "ASSET_VIEW" | "REPLY") {
    setPendingEngagementDraftId(draftId);
    setEngagementMessage(null);
    setEngagementError(null);

    void fetch(`/api/outreach-drafts/${draftId}/engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Logging engagement failed.");
        }
        setEngagementMessage(
          payload.followUpCreated
            ? "Engagement logged and follow-up draft generated."
            : "Engagement logged.",
        );
        router.refresh();
      })
      .catch((cause) => {
        setEngagementError(
          cause instanceof Error ? cause.message : "Logging engagement failed.",
        );
      })
      .finally(() => {
        setPendingEngagementDraftId(null);
      });
  }

  function handleOutreachAction(
    key: string,
    path: string,
    successMessage: string,
    body?: Record<string, unknown>,
  ) {
    setPendingOutreachAction(key);
    setOutreachMessage(null);
    setOutreachError(null);

    void fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Outreach action failed.");
        }
        setOutreachMessage(successMessage);
        router.refresh();
      })
      .catch((cause) => {
        setOutreachError(
          cause instanceof Error ? cause.message : "Outreach action failed.",
        );
      })
      .finally(() => {
        setPendingOutreachAction(null);
      });
  }

  // Called by PipelineActions when the user triggers any pipeline run.
  function handlePipelineStart() {
    setPipelinePollingActive(true);
    setPipelineOpen(true);
  }

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* TOP — Company summary card                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="dashboard-panel rounded-[3rem] p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="dashboard-accent-pill rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em]">
                {lead.company.status}
              </span>
              <span className="dashboard-pill rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em]">
                Score {lead.company.scoreLabel}
              </span>
              {lead.company.industry ? (
                <span className="dashboard-pill rounded-full px-4 py-2 text-xs uppercase tracking-[0.22em]">
                  {lead.company.industry}
                </span>
              ) : null}
            </div>
            <div>
              <h1 className="font-display text-5xl text-[#172033]">{lead.company.name}</h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-[rgba(22,32,51,0.72)]">
                {lead.company.description ?? "No company description yet."}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[rgba(22,32,51,0.72)]">
              <span>{lead.company.website ?? "No website"}</span>
              <span>{lead.company.locationSummary ?? "Unknown region"}</span>
              <span>{lead.company.phone ?? "No phone"}</span>
              <span>Source confidence {lead.company.sourceConfidenceLabel}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <ManualReviewToggle
              initialValue={lead.company.manualReviewRequired}
              leadId={lead.company.id}
            />
            <button
              disabled={archiving}
              onClick={handleArchive}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(22,32,51,0.12)] px-5 py-3 text-sm text-[rgba(22,32,51,0.6)] transition hover:bg-[rgba(22,32,51,0.06)] disabled:opacity-40"
            >
              <Archive className="h-4 w-4" />
              {archiving ? "Archiving…" : "Archive lead"}
            </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* MIDDLE — Pipeline accordion (collapsed by default)                  */}
      {/* ------------------------------------------------------------------ */}
      <section className="dashboard-panel rounded-[2rem]">
        {/* Accordion header */}
        <button
          type="button"
          onClick={() => setPipelineOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition hover:bg-[rgba(22,32,51,0.02)]"
          aria-expanded={pipelineOpen}
        >
          <div className="flex items-center gap-3">
            <span className="font-display text-xl text-[#172033]">Pipeline actions</span>

            {/* Status badge — always shown for quick at-a-glance feedback */}
            {pipelinePollingActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(110,127,217,0.14)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3d4b87]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running…
              </span>
            ) : pipelineHasActivity && !pipelineActionRequired ? (
              <span className="rounded-full bg-[rgba(200,226,192,0.24)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#37523a]">
                {lead.pipeline.completedCount}/{lead.pipeline.totalCount} stages complete
              </span>
            ) : pipelineActionRequired ? (
              <span className="rounded-full bg-[rgba(241,176,143,0.18)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b5b45]">
                Action required
              </span>
            ) : (
              <span className="rounded-full bg-[rgba(101,122,179,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[rgba(22,32,51,0.68)]">
                Pipeline ready
              </span>
            )}
          </div>

          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-[rgba(22,32,51,0.5)] transition-transform duration-200",
              pipelineOpen && "rotate-180",
            )}
          />
        </button>

        {/* Accordion body */}
        <AnimatePresence initial={false}>
          {pipelineOpen ? (
            <motion.div
              key="pipeline-body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 100, damping: 22, mass: 0.8 }}
              style={{ overflow: "hidden" }}
            >
              <div className="border-t border-[rgba(101,122,179,0.1)] px-6 pb-6 pt-5">
                {/* Hint when pipeline has never been run */}
                {!pipelineHasActivity && !pipelinePollingActive ? (
                  <p className="mb-4 text-sm text-[rgba(22,32,51,0.62)]">
                    Run the full pipeline to generate outreach content for this lead.
                  </p>
                ) : null}

                {/* Live polling progress indicator */}
                {pipelinePollingActive ? (
                  <div className="mb-5 rounded-[1.25rem] border border-[rgba(110,127,217,0.18)] bg-[rgba(110,127,217,0.06)] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#3d4b87]" />
                      <span className="text-sm font-medium text-[#172033]">Pipeline running…</span>
                    </div>

                    {pollingStatus && pollingStatus.stages.length > 0 ? (
                      <ul className="space-y-1.5">
                        {pollingStatus.stages.map((stage) => (
                          <li key={stage.stage} className="flex items-center gap-2 text-sm text-[rgba(22,32,51,0.72)]">
                            <StageIcon status={stage.status} />
                            <span className="capitalize">{stage.stage.replaceAll("-", " ").replaceAll("_", " ")}</span>
                            {stage.error ? (
                              <span className="text-xs text-[#8c3640]">— {stage.error}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[rgba(22,32,51,0.5)]">Waiting for first stage…</p>
                    )}

                    {pollingError ? (
                      <p className="mt-2 text-xs text-[#f1b08f]">
                        <RotateCcw className="mr-1 inline h-3 w-3" />
                        {pollingError}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {/* Done/failed summary after polling completes */}
                {!pipelinePollingActive && pollingStatus ? (
                  <div
                    className={cn(
                      "mb-5 rounded-[1.25rem] p-4",
                      pollingStatus.status === "done"
                        ? "border border-[rgba(200,226,192,0.4)] bg-[rgba(200,226,192,0.12)]"
                        : "border border-[rgba(231,120,120,0.2)] bg-[rgba(231,120,120,0.06)]",
                    )}
                  >
                    <p
                      className={cn(
                        "mb-2 text-sm font-medium",
                        pollingStatus.status === "done" ? "text-[#37523a]" : "text-[#8c3640]",
                      )}
                    >
                      {pollingStatus.status === "done"
                        ? "Pipeline completed."
                        : "Pipeline stopped with errors."}
                    </p>
                    {pollingStatus.stages.length > 0 ? (
                      <ul className="space-y-1.5">
                        {pollingStatus.stages.map((stage) => (
                          <li key={stage.stage} className="flex items-center gap-2 text-sm text-[rgba(22,32,51,0.72)]">
                            <StageIcon status={stage.status} />
                            <span className="capitalize">{stage.stage.replaceAll("-", " ").replaceAll("_", " ")}</span>
                            {stage.error ? (
                              <span className="text-xs text-[#8c3640]">— {stage.error}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                <PipelineActions
                  hasWebsite={lead.company.hasWebsite}
                  leadId={lead.company.id}
                  pipeline={lead.pipeline}
                  onPipelineStart={handlePipelineStart}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* BOTTOM — Tabbed content                                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap gap-3">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
              activeTab === id
                ? "border-[rgba(101,122,179,0.24)] bg-[rgba(110,127,217,0.14)] text-[#1d2a47]"
                : "border-[rgba(101,122,179,0.12)] bg-[rgba(255,255,255,0.62)] text-[rgba(22,32,51,0.68)] hover:bg-white",
            )}
            onClick={() => setActiveTab(id)}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <motion.section
        key={activeTab}
        animate={{ opacity: 1, y: 0 }}
        className="dashboard-panel rounded-[2rem] p-6"
        initial={{ opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 90, damping: 22 }}
      >
        {activeTab === "company" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoCard label="Industry" value={lead.company.industry ?? "Unknown"} />
            <InfoCard label="Location" value={lead.company.locationSummary ?? "Unknown"} />
            <InfoCard label="Phone" value={lead.company.phone ?? "Unknown"} />
            <InfoCard label="Review" value={lead.company.manualReviewRequired ? "Manual review required" : "No review flag"} />
          </div>
        ) : null}

        {activeTab === "contacts" ? (
          <div className="grid gap-4">
            {lead.contacts.length > 0 ? (
              lead.contacts.map((contact) => (
                <DetailCard
                  key={contact.id}
                  body={`${contact.title ?? "No title"}${contact.email ? ` • ${contact.email}` : ""}${contact.phone ? ` • ${contact.phone}` : ""}`}
                  label={`Confidence ${contact.confidenceLabel}`}
                  title={contact.fullName}
                />
              ))
            ) : (
              <EmptyPanel message="No contacts enriched yet." />
            )}
          </div>
        ) : null}

        {activeTab === "tech" ? (
          <div className="grid gap-4">
            {lead.technologies.length > 0 ? (
              lead.technologies.map((technology) => (
                <DetailCard
                  key={technology.id}
                  body={technology.category ?? "Uncategorized"}
                  label={`Confidence ${technology.confidenceLabel}`}
                  title={technology.name}
                />
              ))
            ) : (
              <EmptyPanel message="No technology profile yet." />
            )}
          </div>
        ) : null}

        {activeTab === "news" ? (
          <div className="grid gap-4">
            {lead.newsMentions.length > 0 ? (
              lead.newsMentions.map((mention) => (
                <DetailCard
                  key={mention.id}
                  body={mention.articleUrl}
                  label={mention.sourceName ?? "News mention"}
                  title={mention.title}
                />
              ))
            ) : (
              <EmptyPanel message="No news mentions yet." />
            )}
          </div>
        ) : null}

        {activeTab === "pains" ? (
          <div className="grid gap-4">
            {lead.painHypotheses.length > 0 ? (
              lead.painHypotheses.map((pain) => (
                <DetailCard
                  key={pain.id}
                  body={`${pain.businessImpact} ${pain.recommendedServiceAngle}`}
                  label={`Confidence ${pain.confidenceLabel}`}
                  title={pain.primaryPain}
                />
              ))
            ) : (
              <EmptyPanel message="No pain hypotheses generated yet." />
            )}
          </div>
        ) : null}

        {activeTab === "engagement" ? (
          <div className="grid gap-4">
            {lead.engagementEvents.length > 0 ? (
              lead.engagementEvents.map((event) => (
                <DetailCard
                  key={event.id}
                  body={`${event.followUpCreated ? "Follow-up created." : "No follow-up created."} ${event.occurredAtLabel}`}
                  label={`${event.eventType} event`}
                  title={`Draft ${event.draftId}`}
                />
              ))
            ) : (
              <EmptyPanel message="No engagement events recorded yet." />
            )}

            {lead.outreachDrafts.map((draft) => (
              <article
                key={`${draft.id}-engagement-actions`}
                className="dashboard-panel-soft rounded-[1.5rem] p-5"
              >
                <p className="dashboard-eyebrow">
                  {draft.draftType === "FOLLOW_UP" ? `Follow-up sequence ${draft.sequenceStep}` : "Initial outreach"}
                </p>
                <h2 className="mt-3 font-display text-2xl text-[#172033]">{draft.emailSubject1}</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["OPEN", "CLICK", "ASSET_VIEW", "REPLY"] as const).map((eventType) => (
                    <button
                      key={`${draft.id}-${eventType}`}
                      className="dashboard-secondary-button rounded-full px-4 py-2 text-sm disabled:opacity-60"
                      disabled={
                        pendingEngagementDraftId === draft.id ||
                        draft.gmailSyncStatus !== "SYNCED"
                      }
                      onClick={() => handleEngagement(draft.id, eventType)}
                      type="button"
                    >
                      Log {eventType.toLowerCase().replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
                {draft.gmailSyncStatus !== "SYNCED" ? (
                  <p className="mt-3 text-sm text-[rgba(22,32,51,0.62)]">
                    Engagement logging unlocks after this draft has been synced to Gmail.
                  </p>
                ) : null}
              </article>
            ))}

            {engagementMessage ? (
              <p className="text-sm text-[#c8e2c0]">{engagementMessage}</p>
            ) : null}
            {engagementError ? <p className="text-sm text-[#f1b08f]">{engagementError}</p> : null}
          </div>
        ) : null}

        {activeTab === "outreach" ? (
          <div className="grid gap-4">
            {(lead.leadMagnetAssets ?? []).length > 0 ? (
              (lead.leadMagnetAssets ?? []).map((asset) => (
                <article
                  key={asset.id}
                  className="dashboard-panel-soft rounded-[1.5rem] p-5"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <p className="dashboard-eyebrow">
                        Hosted asset
                      </p>
                      <h2 className="font-display text-2xl text-[#172033]">{asset.headline}</h2>
                      <p className="text-sm leading-7 text-[rgba(22,32,51,0.72)]">{asset.intro}</p>
                      <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-[rgba(22,32,51,0.72)]">
                        <span className="dashboard-pill rounded-full px-3 py-1">
                          Views {asset.viewCount}
                        </span>
                        <span className="dashboard-pill rounded-full px-3 py-1">
                          {asset.status.replaceAll("_", " ")}
                        </span>
                        {asset.followUpCreatedAtLabel ? (
                          <span className="dashboard-pill rounded-full px-3 py-1">
                            Follow-up locked {asset.followUpCreatedAtLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <Link
                      className="dashboard-secondary-button inline-flex items-center justify-center rounded-full px-4 py-3 text-sm transition hover:bg-white"
                      href={asset.assetPath}
                    >
                      Open asset page
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-[rgba(22,32,51,0.72)]">
                    {asset.firstViewedAtLabel ? <p>First viewed: {asset.firstViewedAtLabel}</p> : null}
                    {asset.lastViewedAtLabel ? <p>Last viewed: {asset.lastViewedAtLabel}</p> : null}
                    {asset.diagnosticFormUrl ? (
                      <p>
                        Diagnostic form:{" "}
                        <a className="underline decoration-[rgba(101,122,179,0.3)]" href={asset.diagnosticFormUrl}>
                          {asset.diagnosticFormUrl}
                        </a>
                      </p>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <EmptyPanel message="No hosted lead-magnet assets generated yet." />
            )}
            {lead.leadMagnets.length > 0 ? (
              lead.leadMagnets.map((leadMagnet) => (
                <DetailCard
                  key={leadMagnet.id}
                  body={`${leadMagnet.summary} ${leadMagnet.whyItMatchesTheLead} Delivery: ${leadMagnet.suggestedDeliveryFormat}.`}
                  label={leadMagnet.type}
                  title={leadMagnet.title}
                />
              ))
            ) : (
              <EmptyPanel message="No lead magnet generated yet." />
            )}
            {lead.diagnosticForms.length > 0 ? (
              lead.diagnosticForms.map((form) => (
                <article
                  key={form.id}
                  className="dashboard-panel-soft rounded-[1.5rem] p-5"
                >
                  <p className="dashboard-eyebrow">
                    {form.industry}
                  </p>
                  <h2 className="mt-3 font-display text-2xl text-[#172033]">{form.formTitle}</h2>
                  <p className="mt-3 text-sm leading-7 text-[rgba(22,32,51,0.72)]">
                    {form.outreachCtaShort} Estimated completion time: {form.estimatedCompletionTime}. Response status:{" "}
                    {form.responseStatus}.
                  </p>
                  {form.responseSummary ? (
                    <div className="mt-4 grid gap-2 text-sm text-[rgba(22,32,51,0.72)]">
                      {"keyPain" in form.responseSummary && typeof form.responseSummary.keyPain === "string" ? (
                        <p>Key pain: {form.responseSummary.keyPain}</p>
                      ) : null}
                      {"urgencyLevel" in form.responseSummary && typeof form.responseSummary.urgencyLevel === "string" ? (
                        <p>Urgency: {form.responseSummary.urgencyLevel}</p>
                      ) : null}
                      {"budgetReadiness" in form.responseSummary && typeof form.responseSummary.budgetReadiness === "string" ? (
                        <p>Readiness: {form.responseSummary.budgetReadiness}</p>
                      ) : null}
                      {"responseCount" in form.responseSummary && typeof form.responseSummary.responseCount === "number" ? (
                        <p>Responses captured: {form.responseSummary.responseCount}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {form.googleFormUrl ? (
                      <>
                        <Link
                          className="dashboard-secondary-button rounded-full px-4 py-2 text-sm"
                          href={form.googleFormUrl}
                          target="_blank"
                        >
                          Open Google Form
                        </Link>
                        <button
                          className="dashboard-secondary-button rounded-full px-4 py-2 text-sm disabled:opacity-60"
                          disabled={pendingOutreachAction === `form-sync:${form.id}`}
                          onClick={() =>
                            handleOutreachAction(
                              `form-sync:${form.id}`,
                              `/api/leads/${lead.company.id}/diagnostic-form-responses/sync`,
                              "Google Form responses synced.",
                            )
                          }
                          type="button"
                        >
                          Sync responses
                        </button>
                      </>
                    ) : (
                      <button
                        className="dashboard-secondary-button rounded-full px-4 py-2 text-sm disabled:opacity-60"
                        disabled={pendingOutreachAction === `form:${form.id}`}
                        onClick={() =>
                          handleOutreachAction(
                            `form:${form.id}`,
                            `/api/leads/${lead.company.id}/diagnostic-form-link`,
                            "Live Google Form created.",
                            { createLiveForm: true },
                          )
                        }
                        type="button"
                      >
                        Create live Google Form
                      </button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <EmptyPanel message="No diagnostic form generated yet." />
            )}
            {lead.outreachDrafts.length > 0 ? (
              lead.outreachDrafts.map((draft) => (
                <article
                  key={draft.id}
                  className="dashboard-panel-soft rounded-[1.5rem] p-5"
                >
                  <p className="dashboard-eyebrow">
                    {draft.emailSubject2} • {draft.approvalStatus.replaceAll("_", " ")}
                  </p>
                  <h2 className="mt-3 font-display text-2xl text-[#172033]">{draft.emailSubject1}</h2>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-[rgba(22,32,51,0.72)]">
                    {`${draft.coldEmailShort}\n\n${draft.coldEmailMedium}\n\n${draft.assetPath ? `Hosted asset: ${draft.assetPath}\n\n` : ""}${draft.diagnosticFormUrl ? `Diagnostic form: ${draft.diagnosticFormUrl}\n\n` : ""}Follow-up: ${draft.followUp1}\n\nSequence: ${draft.sequenceStep} • ${draft.draftType.replaceAll("_", " ")}\n\nApproval: ${draft.approvalStatus.replaceAll("_", " ")} • Gmail: ${draft.gmailSyncStatus.replaceAll("_", " ")} • Sheets: ${draft.sheetSyncStatus.replaceAll("_", " ")}`}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {draft.approvalStatus === "APPROVED" ? (
                      <>
                        <button
                          className="dashboard-primary-button rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
                          disabled={pendingOutreachAction === `gmail:${draft.id}`}
                          onClick={() =>
                            handleOutreachAction(
                              `gmail:${draft.id}`,
                              `/api/outreach-drafts/${draft.id}/create-gmail-draft`,
                              "Gmail draft created or refreshed.",
                            )
                          }
                          type="button"
                        >
                          {draft.gmailSyncStatus === "SYNCED" ? "Refresh Gmail draft" : "Create Gmail draft"}
                        </button>
                        <button
                          className="dashboard-secondary-button rounded-full px-4 py-2 text-sm disabled:opacity-60"
                          disabled={pendingOutreachAction === `sheets:${draft.id}`}
                          onClick={() =>
                            handleOutreachAction(
                              `sheets:${draft.id}`,
                              `/api/outreach-drafts/${draft.id}/sync-google-sheet`,
                              "Google Sheets ledger updated.",
                            )
                          }
                          type="button"
                        >
                          Sync to Sheets
                        </button>
                        <button
                          className="dashboard-secondary-button rounded-full px-4 py-2 text-sm disabled:opacity-60"
                          disabled={
                            pendingOutreachAction === `thread:${draft.id}` ||
                            draft.gmailSyncStatus !== "SYNCED" ||
                            !draft.gmailThreadId
                          }
                          onClick={() =>
                            handleOutreachAction(
                              `thread:${draft.id}`,
                              `/api/outreach-drafts/${draft.id}/refresh-gmail-thread`,
                              "Gmail thread refreshed.",
                            )
                          }
                          type="button"
                        >
                          Refresh Gmail replies
                        </button>
                        <button
                          className="dashboard-secondary-button rounded-full px-4 py-2 text-sm disabled:opacity-60"
                          disabled={
                            pendingOutreachAction === `hubspot:${draft.id}` ||
                            draft.gmailSyncStatus !== "SYNCED"
                          }
                          onClick={() =>
                            handleOutreachAction(
                              `hubspot:${draft.id}`,
                              `/api/outreach-drafts/${draft.id}/sync-hubspot`,
                              "HubSpot mirror updated.",
                            )
                          }
                          type="button"
                        >
                          Sync HubSpot
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <EmptyPanel message="No outreach drafts generated yet." />
            )}
            {outreachMessage ? <p className="text-sm text-[#c8e2c0]">{outreachMessage}</p> : null}
            {outreachError ? <p className="text-sm text-[#f1b08f]">{outreachError}</p> : null}
            {lead.outreachDrafts.some((draft) => draft.assetPath) ? (
              <div className="dashboard-panel-soft rounded-[1.5rem] p-5">
                <p className="dashboard-eyebrow">
                  Hosted assets
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {lead.outreachDrafts
                    .filter((draft) => draft.assetPath)
                    .map((draft) => (
                      <Link
                        key={`${draft.id}-asset`}
                        className="dashboard-secondary-button rounded-full px-4 py-2 text-sm"
                        href={draft.assetPath ?? "#"}
                        target="_blank"
                      >
                        Open asset for {draft.emailSubject1}
                      </Link>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "linkedin" ? (
          <div className="grid gap-4">
            {lead.linkedinTasks.length > 0 ? (
              lead.linkedinTasks.map((task) => (
                <DetailCard
                  key={task.id}
                  body={`${task.contactTitle ? `${task.contactTitle}. ` : ""}${task.profileUrl ? `Profile: ${task.profileUrl}. ` : ""}${task.connectionRequestNote}\n\nDM: ${task.dmMessage}\n\nFollow-up: ${task.followUpDm}`}
                  label={
                    task.lookupStatus === "MANUAL_LOOKUP_NEEDED"
                      ? "Manual LinkedIn lookup needed"
                      : task.lookupStatus.replaceAll("_", " ")
                  }
                  title={task.contactName ?? "Company-level LinkedIn task"}
                />
              ))
            ) : (
              <EmptyPanel message="No LinkedIn tasks generated yet." />
            )}
          </div>
        ) : null}
      </motion.section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="dashboard-panel-soft rounded-[1.5rem] p-5">
      <p className="dashboard-eyebrow">{label}</p>
      <p className="mt-3 text-lg text-[#172033]">{value}</p>
    </article>
  );
}

function DetailCard({
  title,
  label,
  body,
}: {
  title: string;
  label: string;
  body: string;
}) {
  return (
    <article className="dashboard-panel-soft rounded-[1.5rem] p-5">
      <p className="dashboard-eyebrow">{label}</p>
      <h2 className="mt-3 font-display text-2xl text-[#172033]">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-[rgba(22,32,51,0.72)]">{body}</p>
    </article>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[rgba(101,122,179,0.18)] p-6 text-sm text-[rgba(22,32,51,0.68)]">
      {message}
    </div>
  );
}
