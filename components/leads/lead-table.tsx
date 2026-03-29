"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, ShieldAlert, Sparkles, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { type LeadTableRow } from "@/lib/leads/view-models";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
};

const rowVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 90, damping: 22 },
  },
};

export function LeadTable({ leads }: { leads: LeadTableRow[] }) {
  if (leads.length === 0) {
    return (
      <div className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.92)] p-8 text-[rgba(245,235,212,0.72)]">
        No leads yet. Run Google Places discovery first to populate the dashboard.
      </div>
    );
  }

  return (
    <motion.div
      className="grid gap-4"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      {leads.map((lead) => (
        <motion.article
          key={lead.id}
          variants={rowVariants}
          className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.94)] p-6"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-[rgba(139,105,20,0.16)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-tan">
                  {lead.status}
                </span>
                {lead.manualReviewRequired ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(160,82,45,0.24)] bg-[rgba(160,82,45,0.12)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#f1b08f]">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Needs review
                  </span>
                ) : null}
                {lead.approvalStatus ? (
                  <span className="rounded-full border border-[rgba(210,180,140,0.12)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[rgba(245,235,212,0.72)]">
                    {lead.approvalStatus.replaceAll("_", " ")}
                  </span>
                ) : null}
              </div>

              <div>
                <h2 className="font-display text-3xl text-cream">{lead.name}</h2>
                <p className="mt-2 text-sm text-[rgba(245,235,212,0.72)]">
                  {lead.website ?? "No website available"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-[rgba(245,235,212,0.68)]">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-tan" />
                  {lead.locationSummary ?? "Unknown region"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4 text-tan" />
                  {lead.contactsCount} contact{lead.contactsCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-tan" />
                  Pain confidence {lead.painConfidence?.toFixed(2) ?? "--"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-[220px]">
              <div className="rounded-[1.5rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(255,255,255,0.03)] p-4">
                <p className="font-serif text-xs uppercase tracking-[0.22em] text-tan">
                  Lead score
                </p>
                <p className="mt-2 font-display text-3xl text-cream">{lead.scoreLabel}</p>
                <p className="mt-2 text-xs text-[rgba(245,235,212,0.62)]">
                  Source confidence {lead.sourceConfidence?.toFixed(2) ?? "--"}
                </p>
              </div>

              <Link
                className={cn(
                  "inline-flex items-center justify-between rounded-full border border-[rgba(210,180,140,0.16)] px-5 py-3 text-sm text-cream transition",
                  "hover:border-[rgba(210,180,140,0.3)] hover:bg-[rgba(255,255,255,0.04)]",
                )}
                href={`/leads/${lead.id}`}
              >
                Open lead detail
                <ArrowRight className="h-4 w-4 text-tan" />
              </Link>
            </div>
          </div>
        </motion.article>
      ))}
    </motion.div>
  );
}
