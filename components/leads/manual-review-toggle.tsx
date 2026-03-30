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
      className="dashboard-secondary-button rounded-full px-4 py-2 text-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      onClick={handleToggle}
      type="button"
    >
      {manualReviewRequired ? "Remove manual review" : "Mark for manual review"}
    </button>
  );
}
