import { ArrowRight, DatabaseZap, Flame, Globe2, Mail, SearchCheck } from "lucide-react";

import { PipelinePreview } from "@/components/home/pipeline-preview";

const metrics = [
  {
    label: "Discovery quality",
    value: "Apollo-first",
    detail: "API-first enrichment with source and confidence metadata.",
    icon: SearchCheck,
  },
  {
    label: "Evidence model",
    value: "Strict JSON",
    detail: "Pain hypotheses stay schema-validated and citation-backed.",
    icon: Flame,
  },
  {
    label: "Workflow shape",
    value: "Queue-ready",
    detail: "A clean path from discovery to outreach without LinkedIn automation.",
    icon: DatabaseZap,
  },
];

const operatingLanes = [
  "Google Places for regional business discovery",
  "Apollo for organization and decision-maker enrichment",
  "Firecrawl for public website evidence extraction",
  "OpenAI structured outputs for pains, scoring, and writing",
];

export default function HomePage() {
  return (
    <main className="page-frame min-h-screen">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-6 py-8 sm:px-10 lg:px-12">
        <section className="halo overflow-hidden rounded-[3rem] panel-border panel-sheen shadow-glow">
          <div className="grid gap-10 px-7 py-8 sm:px-10 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-12 lg:py-12">
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center gap-3 text-sm text-tan">
                <span className="rounded-full border border-[rgba(210,180,140,0.2)] bg-[rgba(139,105,20,0.14)] px-4 py-2">
                  Apollo-first enrichment
                </span>
                <span className="rounded-full border border-[rgba(210,180,140,0.2)] bg-[rgba(255,255,255,0.03)] px-4 py-2">
                  Evidence-backed leads
                </span>
                <span className="rounded-full border border-[rgba(210,180,140,0.2)] bg-[rgba(255,255,255,0.03)] px-4 py-2">
                  No LinkedIn automation
                </span>
              </div>

              <div className="space-y-5">
                <p className="font-serif text-lg uppercase tracking-[0.28em] text-tan">
                  Internal operator dashboard
                </p>
                <h1 className="max-w-3xl font-display text-5xl leading-none text-cream sm:text-6xl">
                  Lead Intelligence Engine
                </h1>
                <p className="max-w-2xl text-balance text-lg leading-8 text-[rgba(245,235,212,0.72)]">
                  Discover strong B2B targets, enrich them through Apollo, inspect
                  public evidence, and turn it into structured pain hypotheses before
                  generating outreach.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-sm font-semibold text-[#120f0c] transition hover:bg-[#efe3ca]"
                  href="#pipeline"
                >
                  View pipeline scaffolding
                  <ArrowRight className="h-4 w-4" />
                </a>
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(210,180,140,0.18)] px-5 py-3 text-sm text-tan">
                  <Globe2 className="h-4 w-4" />
                  Google Places, Apollo, Firecrawl, OpenAI
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {metrics.map(({ label, value, detail, icon: Icon }) => (
                  <article
                    key={label}
                    className="rounded-[2rem] border border-[rgba(210,180,140,0.14)] bg-[rgba(255,255,255,0.03)] p-5"
                  >
                    <div className="mb-5 inline-flex rounded-full bg-[rgba(139,105,20,0.16)] p-3 text-tan">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-serif text-sm uppercase tracking-[0.24em] text-tan">
                      {label}
                    </p>
                    <h2 className="mt-3 font-display text-2xl text-cream">{value}</h2>
                    <p className="mt-3 text-sm leading-7 text-[rgba(245,235,212,0.68)]">
                      {detail}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <PipelinePreview />
          </div>
        </section>

        <section
          id="pipeline"
          className="grid gap-6 rounded-[3rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(255,255,255,0.02)] p-7 sm:p-10 lg:grid-cols-[0.8fr_1.2fr]"
        >
          <div className="space-y-5">
            <p className="font-serif text-sm uppercase tracking-[0.28em] text-tan">
              Operating lanes
            </p>
            <h2 className="font-display text-3xl text-cream sm:text-4xl">
              Build fewer leads, with better evidence.
            </h2>
            <p className="max-w-xl text-base leading-8 text-[rgba(245,235,212,0.7)]">
              The MVP is tuned for decision-maker certainty, public evidence strength,
              and service fit. Volume is secondary to lead quality.
            </p>
          </div>

          <div className="grid gap-4">
            {operatingLanes.map((lane) => (
              <div
                key={lane}
                className="flex items-center gap-4 rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.88)] px-5 py-5"
              >
                <div className="rounded-full bg-[rgba(139,105,20,0.16)] p-3 text-tan">
                  <Mail className="h-4 w-4" />
                </div>
                <p className="text-base text-cream">{lane}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
