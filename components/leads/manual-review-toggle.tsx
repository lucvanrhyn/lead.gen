"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

type ManualReviewToggleProps = {
  leadId: string;
  initialValue: boolean;
};

export function ManualReviewToggle({
  leadId,
  initialValue,
}: ManualReviewToggleProps) {
  const router = useRouter();
  const [manualReviewRequired, setManualReviewRequired] = useState(initialValue);
  const [pending, setPending] = useState(false);

  function handleToggle() {
    const nextValue = !manualReviewRequired;

    setPending(true);
    setManualReviewRequired(nextValue);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/leads/${leadId}/manual-review`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            manualReviewRequired: nextValue,
          }),
        });

        if (!response.ok) {
          throw new Error("Unable to update manual review state.");
        }

        router.refresh();
      } catch {
        setManualReviewRequired(!nextValue);
      } finally {
        setPending(false);
      }
    });
  }

  return (
    <button
      className="rounded-full border border-[rgba(210,180,140,0.18)] px-4 py-2 text-sm text-cream transition hover:bg-[rgba(255,255,255,0.04)] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      onClick={handleToggle}
      type="button"
    >
      {manualReviewRequired ? "Remove manual review" : "Mark for manual review"}
    </button>
  );
}
