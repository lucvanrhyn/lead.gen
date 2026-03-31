import Link from "next/link";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { LeadTable } from "@/components/leads/lead-table";
import { getLeadSummaries } from "@/lib/repositories/leads";

export const dynamic = "force-dynamic";

export default async function IndustryLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const industry = decodeURIComponent(slug.replace(/-/g, " "));
  const page = Number(sp.page ?? "1");

  const leadTable = await getLeadSummaries({
    industry,
    page: Number.isFinite(page) ? page : 1,
  });

  return (
    <main className="page-frame min-h-screen px-6 py-8 sm:px-10 lg:px-12">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <div className="dashboard-panel flex flex-col gap-4 rounded-[3rem] p-8">
          <Breadcrumbs
            items={[
              { label: "Leads", href: "/leads" },
              { label: industry },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="dashboard-eyebrow">Industry</p>
              <h1 className="mt-3 font-display text-5xl capitalize text-[#172033]">{industry}</h1>
            </div>
            <Link
              className="dashboard-secondary-button rounded-full px-5 py-3 text-sm transition hover:bg-white"
              href="/leads"
            >
              All industries
            </Link>
          </div>
        </div>

        <LeadTable leads={leadTable.leads} pagination={leadTable.pagination} industrySlug={slug} />
      </div>
    </main>
  );
}
