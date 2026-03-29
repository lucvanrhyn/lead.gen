import { notFound } from "next/navigation";

import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { getLeadDetail } from "@/lib/repositories/leads";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lead = await getLeadDetail(id);

  if (!lead) {
    notFound();
  }

  return (
    <main className="min-h-screen px-6 py-8 sm:px-10 lg:px-12">
      <div className="mx-auto w-full max-w-7xl">
        <LeadDetailView lead={lead} />
      </div>
    </main>
  );
}
