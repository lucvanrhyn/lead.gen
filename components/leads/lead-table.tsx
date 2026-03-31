"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Archive, ArrowLeft, ArrowRight, MapPin, ShieldAlert, Sparkles, Trash2, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { type LeadTablePagination, type LeadTableRow } from "@/lib/leads/view-models";

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

function LeadRow({
  lead,
  onArchive,
  onDelete,
}: {
  lead: LeadTableRow;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleArchive() {
    setBusy(true);
    await onArchive(lead.id);
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    await onDelete(lead.id);
    setBusy(false);
  }

  return (
    <motion.article
      variants={rowVariants}
      className="dashboard-panel rounded-[2rem] p-6"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[rgba(139,105,20,0.16)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-tan">
              {lead.status}
            </span>
            {lead.manualReviewRequired ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(194,126,82,0.24)] bg-[rgba(194,126,82,0.1)] px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#b26d4c]">
                <ShieldAlert className="h-3.5 w-3.5" />
                Needs review
              </span>
            ) : null}
            {lead.approvalStatus ? (
              <span className="dashboard-pill rounded-full px-3 py-1 text-xs uppercase tracking-[0.22em]">
                {lead.approvalStatus.replaceAll("_", " ")}
              </span>
            ) : null}
          </div>

          <div>
            <h2 className="font-display text-3xl text-[#172033]">{lead.name}</h2>
            <p className="mt-2 text-sm text-[rgba(22,32,51,0.72)]">
              {lead.website ?? "No website available"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-[rgba(22,32,51,0.68)]">
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#6e7fd9]" />
              {lead.locationSummary ?? "Unknown region"}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4 text-[#6e7fd9]" />
              {lead.contactsCount} contact{lead.contactsCount === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#8d76d8]" />
              Pain confidence {lead.painConfidence?.toFixed(2) ?? "--"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 lg:min-w-[220px]">
          <div className="dashboard-panel-soft rounded-[1.5rem] p-4">
            <p className="dashboard-eyebrow">
              Lead score
            </p>
            <p className="mt-2 font-display text-3xl text-[#172033]">{lead.scoreLabel}</p>
            <p className="mt-2 text-xs text-[rgba(22,32,51,0.62)]">
              Source confidence {lead.sourceConfidence?.toFixed(2) ?? "--"}
            </p>
          </div>

          <Link
            className={cn(
              "dashboard-secondary-button inline-flex items-center justify-between rounded-full px-5 py-3 text-sm transition",
              "hover:bg-white",
            )}
            href={`/leads/${lead.id}`}
          >
            Open lead detail
            <ArrowRight className="h-4 w-4 text-[#6e7fd9]" />
          </Link>

          <div className="flex gap-2">
            <button
              disabled={busy}
              onClick={handleArchive}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-[rgba(22,32,51,0.12)] px-4 py-2 text-xs text-[rgba(22,32,51,0.6)] transition hover:bg-[rgba(22,32,51,0.06)] disabled:opacity-40"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>

            <button
              disabled={busy}
              onClick={handleDelete}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs transition disabled:opacity-40",
                confirmDelete
                  ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                  : "border-[rgba(22,32,51,0.12)] text-[rgba(22,32,51,0.6)] hover:bg-[rgba(22,32,51,0.06)]",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmDelete ? "Confirm" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

export function LeadTable({
  leads: initialLeads,
  pagination,
  industrySlug,
}: {
  leads: LeadTableRow[];
  pagination?: LeadTablePagination;
  industrySlug?: string;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState(initialLeads);

  const basePath = industrySlug ? `/leads/industry/${industrySlug}` : "/leads";

  async function handleArchive(id: string) {
    await fetch(`/api/leads/${id}/archive`, { method: "POST" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    router.refresh();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/leads/${id}/archive`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    router.refresh();
  }

  if (leads.length === 0) {
    return (
      <div className="dashboard-panel rounded-[2rem] p-8 text-[rgba(22,32,51,0.72)]">
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
        <LeadRow
          key={lead.id}
          lead={lead}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />
      ))}

      {pagination && pagination.totalPages > 1 ? (
        <div className="dashboard-panel rounded-[1.5rem] flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="text-sm text-[rgba(22,32,51,0.68)]">
            Page {pagination.page} of {pagination.totalPages}
          </div>

          <div className="flex items-center gap-3">
            {pagination.hasPreviousPage ? (
              <Link
                aria-label="Previous page"
                className="dashboard-secondary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition hover:bg-white"
                href={`${basePath}?page=${pagination.page - 1}`}
              >
                <ArrowLeft className="h-4 w-4" />
                Previous page
              </Link>
            ) : null}

            {pagination.hasNextPage ? (
              <Link
                aria-label="Next page"
                className="dashboard-secondary-button inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition hover:bg-white"
                href={`${basePath}?page=${pagination.page + 1}`}
              >
                Next page
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
