import Link from "next/link";

import { ApprovalQueue } from "@/components/leads/approval-queue";
import { DiscoveryForm } from "@/components/leads/discovery-form";
import { LeadTable } from "@/components/leads/lead-table";
import { getApprovalQueue, getLeadSummaries } from "@/lib/repositories/leads";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [leads, approvalQueue] = await Promise.all([getLeadSummaries(), getApprovalQueue()]);

  return (
    <main className="min-h-screen px-6 py-8 sm:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="flex flex-col gap-4 rounded-[3rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.94)] p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-serif text-sm uppercase tracking-[0.28em] text-tan">
                Lead dashboard
              </p>
              <h1 className="mt-3 font-display text-5xl text-cream">Lead table</h1>
            </div>
            <Link
              className="rounded-full border border-[rgba(210,180,140,0.16)] px-5 py-3 text-sm text-cream transition hover:bg-[rgba(255,255,255,0.04)]"
              href="/"
            >
              Back to overview
            </Link>
          </div>
          <p className="max-w-3xl text-base leading-8 text-[rgba(245,235,212,0.72)]">
            Choose an industry and region, generate a focused lead batch, then open any lead to enrich, score, create a lead magnet, and draft personalized outreach.
          </p>
        </div>

        <DiscoveryForm />
        <ApprovalQueue items={approvalQueue.items} summary={approvalQueue.summary} />
        <LeadTable leads={leads} />
      </div>
    </main>
  );
}
