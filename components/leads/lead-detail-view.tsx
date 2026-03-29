"use client";

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

  return (
    <div className="space-y-6">
      <PipelineActions
        hasWebsite={lead.company.hasWebsite}
        leadId={lead.company.id}
      />

      <section className="rounded-[3rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.94)] p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[rgba(139,105,20,0.16)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-tan">
                {lead.company.status}
              </span>
              <span className="rounded-full border border-[rgba(210,180,140,0.12)] px-4 py-2 text-xs uppercase tracking-[0.22em] text-[rgba(245,235,212,0.72)]">
                Score {lead.company.scoreLabel}
              </span>
            </div>
            <div>
              <h1 className="font-display text-5xl text-cream">{lead.company.name}</h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-[rgba(245,235,212,0.72)]">
                {lead.company.description ?? "No company description yet."}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-[rgba(245,235,212,0.72)]">
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
                ? "border-[rgba(210,180,140,0.3)] bg-[rgba(139,105,20,0.16)] text-cream"
                : "border-[rgba(210,180,140,0.12)] text-[rgba(245,235,212,0.68)] hover:bg-[rgba(255,255,255,0.04)]",
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
        className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.92)] p-6"
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
                className="rounded-[1.5rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(255,255,255,0.03)] p-5"
              >
                <p className="font-serif text-xs uppercase tracking-[0.22em] text-tan">
                  {draft.draftType === "FOLLOW_UP" ? `Follow-up sequence ${draft.sequenceStep}` : "Initial outreach"}
                </p>
                <h2 className="mt-3 font-display text-2xl text-cream">{draft.emailSubject1}</h2>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["OPEN", "CLICK", "ASSET_VIEW", "REPLY"] as const).map((eventType) => (
                    <button
                      key={`${draft.id}-${eventType}`}
                      className="rounded-full border border-[rgba(210,180,140,0.16)] px-4 py-2 text-sm text-cream disabled:opacity-60"
                      disabled={pendingEngagementDraftId === draft.id}
                      onClick={() => handleEngagement(draft.id, eventType)}
                      type="button"
                    >
                      Log {eventType.toLowerCase().replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
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
                <DetailCard
                  key={form.id}
                  body={`${form.outreachCtaShort} Estimated completion time: ${form.estimatedCompletionTime}.${form.googleFormUrl ? ` Google Form: ${form.googleFormUrl}.` : ""} Response status: ${form.responseStatus}.`}
                  label={form.industry}
                  title={form.formTitle}
                />
              ))
            ) : (
              <EmptyPanel message="No diagnostic form generated yet." />
            )}
            {lead.outreachDrafts.length > 0 ? (
              lead.outreachDrafts.map((draft) => (
                <DetailCard
                  key={draft.id}
                  body={`${draft.coldEmailShort}\n\n${draft.coldEmailMedium}\n\nFollow-up: ${draft.followUp1}\n\nSequence: ${draft.sequenceStep} • ${draft.draftType.replaceAll("_", " ")}\n\nApproval: ${draft.approvalStatus.replaceAll("_", " ")} • Gmail: ${draft.gmailSyncStatus.replaceAll("_", " ")} • Sheets: ${draft.sheetSyncStatus.replaceAll("_", " ")}`}
                  label={`${draft.emailSubject2} • ${draft.approvalStatus.replaceAll("_", " ")}`}
                  title={draft.emailSubject1}
                />
              ))
            ) : (
              <EmptyPanel message="No outreach drafts generated yet." />
            )}
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
    <article className="rounded-[1.5rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
      <p className="font-serif text-xs uppercase tracking-[0.22em] text-tan">{label}</p>
      <p className="mt-3 text-lg text-cream">{value}</p>
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
    <article className="rounded-[1.5rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(255,255,255,0.03)] p-5">
      <p className="font-serif text-xs uppercase tracking-[0.22em] text-tan">{label}</p>
      <h2 className="mt-3 font-display text-2xl text-cream">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-[rgba(245,235,212,0.72)]">{body}</p>
    </article>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-[rgba(210,180,140,0.18)] p-6 text-sm text-[rgba(245,235,212,0.68)]">
      {message}
    </div>
  );
}
