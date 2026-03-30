"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Activity, Linkedin, Mail, Newspaper, ScanSearch, Sparkles, Users, Wrench } from "lucide-react";

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

export function LeadDetailView({ lead }: { lead: LeadDetailViewModel }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("company");
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
      headers: {
        "Content-Type": "application/json",
      },
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
      headers: {
        "Content-Type": "application/json",
      },
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

  return (
    <div className="space-y-6">
      <PipelineActions
        hasWebsite={lead.company.hasWebsite}
        leadId={lead.company.id}
        pipeline={lead.pipeline}
      />

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

          <ManualReviewToggle
            initialValue={lead.company.manualReviewRequired}
            leadId={lead.company.id}
          />
        </div>
      </section>

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
