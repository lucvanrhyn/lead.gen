/**
 * Pure-function extraction of pain signals from Google reviews.
 *
 * No API calls — just data transformation. Summarizes review sentiment
 * into structured signals that feed into pain hypothesis generation.
 */

import type { GoogleReview } from "@/lib/providers/google-reviews";

export type ReviewPainSignals = {
  averageRating: number | null;
  reviewCount: number;
  negativeExcerpts: string[];
  complaintThemes: string[];
  summary: string;
};

const COMPLAINT_PATTERNS: ReadonlyArray<{ pattern: RegExp; theme: string }> = [
  { pattern: /wait|waiting|slow|delayed|took forever/i, theme: "Long wait times" },
  { pattern: /rude|unfriendly|unprofessional|attitude/i, theme: "Poor customer service" },
  { pattern: /expensive|overpriced|overcharg|price|cost/i, theme: "Pricing concerns" },
  { pattern: /dirty|unclean|messy|hygiene/i, theme: "Cleanliness issues" },
  { pattern: /broke|broken|not work|malfunction|defect/i, theme: "Quality or maintenance issues" },
  { pattern: /no response|never called|ignored|ghosted|unreachable/i, theme: "Poor communication" },
  { pattern: /book|appoint|schedul|cancel/i, theme: "Booking or scheduling friction" },
  { pattern: /website|online|app|digital/i, theme: "Digital experience gaps" },
  { pattern: /parking|location|find|access/i, theme: "Accessibility issues" },
  { pattern: /staff|employee|team|worker/i, theme: "Staffing concerns" },
];

const NEGATIVE_RATING_THRESHOLD = 3;
const EXCERPT_MAX_LENGTH = 200;

function truncateExcerpt(text: string): string {
  if (text.length <= EXCERPT_MAX_LENGTH) return text;
  return `${text.slice(0, EXCERPT_MAX_LENGTH)}...`;
}

function computeAverageRating(reviews: readonly GoogleReview[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Number((sum / reviews.length).toFixed(2));
}

function extractComplaintThemes(negativeReviews: readonly GoogleReview[]): string[] {
  const found = new Set<string>();

  for (const review of negativeReviews) {
    for (const { pattern, theme } of COMPLAINT_PATTERNS) {
      if (pattern.test(review.text)) {
        found.add(theme);
      }
    }
  }

  return [...found];
}

function buildSummary(signals: {
  averageRating: number | null;
  reviewCount: number;
  negativeCount: number;
  complaintThemes: string[];
}): string {
  if (signals.reviewCount === 0) {
    return "No Google reviews available.";
  }

  const parts: string[] = [];

  if (signals.averageRating !== null) {
    parts.push(`Average rating: ${signals.averageRating}/5 across ${signals.reviewCount} reviews.`);
  }

  if (signals.negativeCount > 0) {
    parts.push(`${signals.negativeCount} negative review${signals.negativeCount === 1 ? "" : "s"} found.`);
  }

  if (signals.complaintThemes.length > 0) {
    parts.push(`Common complaints: ${signals.complaintThemes.join(", ")}.`);
  }

  return parts.join(" ");
}

export function extractPainSignals(reviews: readonly GoogleReview[]): ReviewPainSignals {
  const averageRating = computeAverageRating(reviews);

  const negativeReviews = reviews.filter((r) => r.rating <= NEGATIVE_RATING_THRESHOLD);

  const negativeExcerpts = negativeReviews
    .filter((r) => r.text.trim().length > 0)
    .map((r) => truncateExcerpt(r.text));

  const complaintThemes = extractComplaintThemes(negativeReviews);

  const summary = buildSummary({
    averageRating,
    reviewCount: reviews.length,
    negativeCount: negativeReviews.length,
    complaintThemes,
  });

  return {
    averageRating,
    reviewCount: reviews.length,
    negativeExcerpts,
    complaintThemes,
    summary,
  };
}
