"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Play, RefreshCw, WandSparkles } from "lucide-react";

import { type LeadPipelineViewModel } from "@/lib/leads/view-models";

type PipelineActionsProps = {
  leadId: string;
  hasWebsite: boolean;
  pipeline: LeadPipelineViewModel;
  /** Called immediately when the user triggers any pipeline action. */
  onPipelineStart?: () => void;
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

function getStageBadgeClasses(status: LeadPipelineViewModel["stages"][number]["status"]) {
  switch (status) {
    case "SUCCEEDED":
      return "bg-[rgba(200,226,192,0.24)] text-[#37523a]";
    case "PARTIAL":
      return "bg-[rgba(241,176,143,0.18)] text-[#8b5b45]";
    case "FAILED":
      return "bg-[rgba(231,120,120,0.16)] text-[#8c3640]";
    case "RUNNING":
      return "bg-[rgba(110,127,217,0.14)] text-[#3d4b87]";
    case "BLOCKED":
      return "bg-[rgba(22,32,51,0.08)] text-[rgba(22,32,51,0.68)]";
    default:
      return "bg-[rgba(101,122,179,0.08)] text-[rgba(22,32,51,0.68)]";
  }
}

function summarizePipelineResult(payload: {
  status?: string;
  stages?: Array<{ status?: string }>;
}) {
  const stages = Array.isArray(payload.stages) ? payload.stages : [];
  const succeededCount = stages.filter((stage) => stage.status === "SUCCEEDED").length;
  const partialCount = stages.filter((stage) => stage.status === "PARTIAL").length;
  const failedCount = stages.filter((stage) => stage.status === "FAILED").length;

  if (payload.status === "FAILED" || failedCount > 0) {
    return "The pipeline stopped with at least one failed stage.";
  }

  if (partialCount > 0) {
    return `${succeededCount} stage${succeededCount === 1 ? "" : "s"} completed and ${partialCount} finished with partial results.`;
  }

  return "Full lead pipeline completed.";
}

export function PipelineActions({ leadId, hasWebsite, pipeline, onPipelineStart }: PipelineActionsProps) {
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
    onPipelineStart?.();

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
    onPipelineStart?.();

    startTransition(async () => {
      try {
        const response = await fetch(`/api/leads/${leadId}/pipeline`, {
          method: "POST",
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error ?? "Full pipeline failed.");
        }

        if (payload.status === "FAILED") {
          setError(payload.error ?? "Full pipeline failed.");
        } else {
          setMessage(summarizePipelineResult(payload));
        }
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Full pipeline failed.");
      } finally {
        setPendingAction(null);
      }
    });
  }

  return (
    <section className="dashboard-panel rounded-[2rem] p-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="dashboard-eyebrow">
              Pipeline actions
            </p>
            <h2 className="mt-2 font-display text-3xl text-[#172033]">
              Run the generator on this lead
            </h2>
          </div>

          <button
            className="dashboard-primary-button inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
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
              className="dashboard-panel-soft inline-flex items-center justify-between rounded-[1.25rem] px-4 py-4 text-left text-sm text-[#172033] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingAction !== null || (action.endpoint === "crawl" && !hasWebsite)}
              onClick={() => handleSingleAction(action.endpoint, action.label)}
              type="button"
            >
              <span>{action.label}</span>
              {pendingAction === action.endpoint ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-[#6e7fd9]" />
              ) : (
                <WandSparkles className="h-4 w-4 text-[#8d76d8]" />
              )}
            </button>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {pipeline.stages.map((stage) => (
            <article
              key={stage.id}
              className="dashboard-panel-soft rounded-[1.25rem] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#172033]">{stage.label}</p>
                  <p className="mt-2 text-sm text-[rgba(22,32,51,0.68)]">{stage.detail}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getStageBadgeClasses(stage.status)}`}
                >
                  {stage.status.replaceAll("_", " ")}
                </span>
              </div>
              {stage.updatedAtLabel ? (
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[rgba(22,32,51,0.5)]">
                  Updated {stage.updatedAtLabel}
                </p>
              ) : null}
            </article>
          ))}
        </div>

        {message ? (
          <div className="inline-flex items-center gap-2 text-sm text-[#c8e2c0]">
            <RefreshCw className="h-4 w-4" />
            {message} {pipeline.completedCount}/{pipeline.totalCount} stages currently have output.
          </div>
        ) : null}

        {error ? <p className="text-sm text-[#f1b08f]">{error}</p> : null}
      </div>
    </section>
  );
}
