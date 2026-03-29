"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Mail, Newspaper, ScanSearch, Sparkles, Users, Wrench } from "lucide-react";

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
  { id: "outreach", label: "Outreach", icon: Mail },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function LeadDetailView({ lead }: { lead: LeadDetailViewModel }) {
  const [activeTab, setActiveTab] = useState<TabId>("company");

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
                  body={`${draft.coldEmailShort}\n\n${draft.coldEmailMedium}\n\nFollow-up: ${draft.followUp1}\n\nApproval: ${draft.approvalStatus.replaceAll("_", " ")} • Gmail: ${draft.gmailSyncStatus.replaceAll("_", " ")} • Sheets: ${draft.sheetSyncStatus.replaceAll("_", " ")}`}
                  label={`${draft.emailSubject2} • ${draft.approvalStatus.replaceAll("_", " ")}`}
                  title={draft.emailSubject1}
                />
              ))
            ) : (
              <EmptyPanel message="No outreach drafts generated yet." />
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
