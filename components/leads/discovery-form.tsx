"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchCheck, Trash2 } from "lucide-react";

type DiscoveryState = {
  industry: string;
  region: string;
  maxResults: number;
};

const initialState: DiscoveryState = {
  industry: "Dental Clinics",
  region: "Cape Town, South Africa",
  maxResults: 5,
};

export function DiscoveryForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialState);
  const [pending, setPending] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateField<Key extends keyof DiscoveryState>(key: Key, value: DiscoveryState[Key]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/discovery/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...form,
            persist: true,
            autoRunPipeline: true,
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Discovery failed.");
        }

        setMessage(
          `Discovered ${payload.candidates?.length ?? 0} lead${payload.candidates?.length === 1 ? "" : "s"} for ${form.industry} in ${form.region} and started the full pipeline for batch ${payload.batch?.id ?? "run"}.`,
        );
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Discovery failed.");
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <form
      className="dashboard-panel grid gap-4 rounded-[2rem] p-6"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-[linear-gradient(135deg,rgba(141,118,216,0.18),rgba(110,127,217,0.18))] p-3 text-[#4a4b91]">
          <SearchCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl text-[#172033]">Find leads by industry</h2>
          <p className="dashboard-copy text-sm">
            Choose the industry and region, then create a batch of evidence-backed lead candidates.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_0.6fr_auto]">
        <label className="grid gap-2 text-sm text-[rgba(22,32,51,0.74)]">
          Industry
          <input
            className="rounded-[1rem] border border-[rgba(101,122,179,0.16)] bg-[rgba(248,250,255,0.94)] px-4 py-3 text-[#172033] outline-none transition focus:border-[rgba(101,122,179,0.32)]"
            onChange={(event) => updateField("industry", event.target.value)}
            placeholder="Dental Clinics"
            value={form.industry}
          />
        </label>

        <label className="grid gap-2 text-sm text-[rgba(22,32,51,0.74)]">
          Region
          <input
            className="rounded-[1rem] border border-[rgba(101,122,179,0.16)] bg-[rgba(248,250,255,0.94)] px-4 py-3 text-[#172033] outline-none transition focus:border-[rgba(101,122,179,0.32)]"
            onChange={(event) => updateField("region", event.target.value)}
            placeholder="Cape Town, South Africa"
            value={form.region}
          />
        </label>

        <label className="grid gap-2 text-sm text-[rgba(22,32,51,0.74)]">
          Volume
          <input
            className="rounded-[1rem] border border-[rgba(101,122,179,0.16)] bg-[rgba(248,250,255,0.94)] px-4 py-3 text-[#172033] outline-none transition focus:border-[rgba(101,122,179,0.32)]"
            max={20}
            min={1}
            onChange={(event) => updateField("maxResults", Number(event.target.value))}
            type="number"
            value={form.maxResults}
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            className="dashboard-primary-button rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending || clearing}
            type="submit"
          >
            {pending ? "Finding..." : "Find leads"}
          </button>

          <button
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm transition disabled:opacity-40 ${
              confirmClear
                ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
                : "border-[rgba(22,32,51,0.12)] text-[rgba(22,32,51,0.5)] hover:bg-[rgba(22,32,51,0.06)]"
            }`}
            disabled={pending || clearing}
            onClick={(e) => {
              e.preventDefault();
              if (!confirmClear) {
                setConfirmClear(true);
                return;
              }
              setClearing(true);
              setConfirmClear(false);
              setMessage(null);
              setError(null);
              void fetch("/api/leads/clear", { method: "POST" })
                .then(async (res) => {
                  if (!res.ok) throw new Error("Clear failed.");
                  setMessage("All leads cleared.");
                  router.refresh();
                })
                .catch(() => setError("Failed to clear leads."))
                .finally(() => setClearing(false));
            }}
            type="button"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {clearing ? "Clearing..." : confirmClear ? "Confirm clear all" : "Clear all"}
          </button>
        </div>
      </div>

      {message ? <p className="text-sm text-[#365f46]">{message.replace("started the full pipeline", "queued the pipeline")}</p> : null}
      {error ? <p className="text-sm text-[#f1b08f]">{error}</p> : null}
    </form>
  );
}
