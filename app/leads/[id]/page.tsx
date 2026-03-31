import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { dispatchDiscoveryProcessing } from "@/lib/jobs/dispatch";
import { getLeadDetail } from "@/lib/repositories/leads";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${protocol}://${host}` : undefined;
  const { id } = await params;
  const lead = await getLeadDetail(id);

  if (!lead) {
    notFound();
  }

  after(async () => {
    await dispatchDiscoveryProcessing({ origin });
  });

  const industrySlug = lead.company.industry
    ? encodeURIComponent(lead.company.industry.toLowerCase().replace(/\s+/g, "-"))
    : null;

  const breadcrumbItems = industrySlug
    ? [
        { label: "Leads", href: "/leads" },
        { label: lead.company.industry!, href: `/leads/industry/${industrySlug}` },
        { label: lead.company.name },
      ]
    : [
        { label: "Leads", href: "/leads" },
        { label: lead.company.name },
      ];

  return (
    <main className="min-h-screen px-6 py-8 sm:px-10 lg:px-12">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <Breadcrumbs items={breadcrumbItems} />
        <LeadDetailView lead={lead} />
      </div>
    </main>
  );
}
