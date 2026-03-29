"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchCheck } from "lucide-react";

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
          }),
        });

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Discovery failed.");
        }

        setMessage(
          `Discovered ${payload.candidates?.length ?? 0} lead${payload.candidates?.length === 1 ? "" : "s"} for ${form.industry} in ${form.region}.`,
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
      className="grid gap-4 rounded-[2rem] border border-[rgba(210,180,140,0.12)] bg-[rgba(255,255,255,0.03)] p-6"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-[rgba(139,105,20,0.16)] p-3 text-tan">
          <SearchCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-2xl text-cream">Find leads by industry</h2>
          <p className="text-sm text-[rgba(245,235,212,0.68)]">
            Choose the industry and region, then create a batch of evidence-backed lead candidates.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1.2fr_0.6fr_auto]">
        <label className="grid gap-2 text-sm text-[rgba(245,235,212,0.72)]">
          Industry
          <input
            className="rounded-[1rem] border border-[rgba(210,180,140,0.18)] bg-[rgba(10,8,6,0.45)] px-4 py-3 text-cream outline-none transition focus:border-[rgba(210,180,140,0.32)]"
            onChange={(event) => updateField("industry", event.target.value)}
            placeholder="Dental Clinics"
            value={form.industry}
          />
        </label>

        <label className="grid gap-2 text-sm text-[rgba(245,235,212,0.72)]">
          Region
          <input
            className="rounded-[1rem] border border-[rgba(210,180,140,0.18)] bg-[rgba(10,8,6,0.45)] px-4 py-3 text-cream outline-none transition focus:border-[rgba(210,180,140,0.32)]"
            onChange={(event) => updateField("region", event.target.value)}
            placeholder="Cape Town, South Africa"
            value={form.region}
          />
        </label>

        <label className="grid gap-2 text-sm text-[rgba(245,235,212,0.72)]">
          Volume
          <input
            className="rounded-[1rem] border border-[rgba(210,180,140,0.18)] bg-[rgba(10,8,6,0.45)] px-4 py-3 text-cream outline-none transition focus:border-[rgba(210,180,140,0.32)]"
            max={20}
            min={1}
            onChange={(event) => updateField("maxResults", Number(event.target.value))}
            type="number"
            value={form.maxResults}
          />
        </label>

        <button
          className="rounded-full bg-cream px-5 py-3 text-sm font-semibold text-[#120f0c] transition hover:bg-[#efe3ca] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Finding..." : "Find leads"}
        </button>
      </div>

      {message ? <p className="text-sm text-[#c8e2c0]">{message}</p> : null}
      {error ? <p className="text-sm text-[#f1b08f]">{error}</p> : null}
    </form>
  );
}
