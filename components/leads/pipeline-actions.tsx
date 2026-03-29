"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Play, RefreshCw, WandSparkles } from "lucide-react";

type PipelineActionsProps = {
  leadId: string;
  hasWebsite: boolean;
};

const actionConfig = [
  { id: "enrich", label: "Apollo enrich", endpoint: "enrich" },
  { id: "crawl", label: "Extract site", endpoint: "crawl" },
  { id: "pain", label: "Generate pains", endpoint: "pain-hypothesis" },
  { id: "score", label: "Score lead", endpoint: "score" },
  { id: "magnet", label: "Create lead magnet", endpoint: "lead-magnet" },
  { id: "form", label: "Generate form", endpoint: "diagnostic-form" },
  { id: "outreach", label: "Draft outreach", endpoint: "outreach" },
] as const;

export function PipelineActions({ leadId, hasWebsite }: PipelineActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAction(endpoint: string, label: string) {
    const response = await fetch(`/api/leads/${leadId}/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ persist: true }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error ?? `${label} failed.`);
    }

    return payload;
  }

  function handleSingleAction(endpoint: string, label: string) {
    setPendingAction(endpoint);
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        await runAction(endpoint, label);
        setMessage(`${label} completed.`);
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : `${label} failed.`);
      } finally {
        setPendingAction(null);
      }
    });
  }

  function handleRunAll() {
    setPendingAction("full-pipeline");
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        await runAction("enrich", "Apollo enrich");

        if (hasWebsite) {
          await runAction("crawl", "Extract site");
        }

        await runAction("pain-hypothesis", "Generate pains");
        await runAction("score", "Score lead");
        await runAction("lead-magnet", "Create lead magnet");
        await runAction("diagnostic-form", "Generate form");
        await runAction("outreach", "Draft outreach");

        setMessage("Full lead pipeline completed.");
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Full pipeline failed.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <section className="rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(26,21,16,0.92)] p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-serif text-xs uppercase tracking-[0.22em] text-tan">
              Pipeline actions
            </p>
            <h2 className="mt-2 font-display text-3xl text-cream">
              Run the generator on this lead
            </h2>
          </div>

          <button
            className="inline-flex items-center gap-2 rounded-full bg-cream px-5 py-3 text-sm font-semibold text-[#120f0c] transition hover:bg-[#efe3ca] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingAction !== null}
            onClick={handleRunAll}
            type="button"
          >
            {pendingAction === "full-pipeline" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Run full pipeline
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {actionConfig.map((action) => (
            <button
              key={action.id}
              className="inline-flex items-center justify-between rounded-[1.25rem] border border-[rgba(210,180,140,0.14)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-left text-sm text-cream transition hover:bg-[rgba(255,255,255,0.06)] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingAction !== null}
              onClick={() => handleSingleAction(action.endpoint, action.label)}
              type="button"
            >
              <span>{action.label}</span>
              {pendingAction === action.endpoint ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-tan" />
              ) : (
                <WandSparkles className="h-4 w-4 text-tan" />
              )}
            </button>
          ))}
        </div>

        {message ? (
          <div className="inline-flex items-center gap-2 text-sm text-[#c8e2c0]">
            <RefreshCw className="h-4 w-4" />
            {message}
          </div>
        ) : null}

        {error ? <p className="text-sm text-[#f1b08f]">{error}</p> : null}
      </div>
    </section>
  );
}
