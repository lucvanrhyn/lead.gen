import { extractPainSignals, type ReviewPainSignals } from "@/lib/domain/review-signals";
import type { GoogleReview } from "@/lib/providers/google-reviews";

function makeReview(overrides: Partial<GoogleReview> = {}): GoogleReview {
  return {
    author: "Test User",
    rating: 4,
    text: "Good experience overall.",
    relativeTime: "1 week ago",
    ...overrides,
  };
}

describe("extractPainSignals", () => {
  it("returns empty signals for an empty reviews array", () => {
    const signals = extractPainSignals([]);

    expect(signals).toEqual({
      averageRating: null,
      reviewCount: 0,
      negativeExcerpts: [],
      complaintThemes: [],
      summary: "No Google reviews available.",
    });
  });

  it("computes average rating correctly", () => {
    const reviews = [
      makeReview({ rating: 5 }),
      makeReview({ rating: 3 }),
      makeReview({ rating: 1 }),
    ];

    const signals = extractPainSignals(reviews);

    expect(signals.averageRating).toBe(3);
    expect(signals.reviewCount).toBe(3);
  });

  it("extracts negative excerpts from low-rated reviews", () => {
    const reviews = [
      makeReview({ rating: 5, text: "Amazing!" }),
      makeReview({ rating: 2, text: "Terrible experience, very rude staff." }),
      makeReview({ rating: 1, text: "Would not recommend. Waited forever." }),
    ];

    const signals = extractPainSignals(reviews);

    expect(signals.negativeExcerpts).toHaveLength(2);
    expect(signals.negativeExcerpts).toContain("Terrible experience, very rude staff.");
    expect(signals.negativeExcerpts).toContain("Would not recommend. Waited forever.");
  });

  it("includes rating=3 as negative (threshold)", () => {
    const reviews = [makeReview({ rating: 3, text: "Mediocre service." })];

    const signals = extractPainSignals(reviews);

    expect(signals.negativeExcerpts).toContain("Mediocre service.");
  });

  it("does not include rating=4 as negative", () => {
    const reviews = [makeReview({ rating: 4, text: "Pretty good." })];

    const signals = extractPainSignals(reviews);

    expect(signals.negativeExcerpts).toHaveLength(0);
  });

  it("identifies complaint themes from negative reviews", () => {
    const reviews = [
      makeReview({ rating: 1, text: "Waited 30 minutes, incredibly slow service." }),
      makeReview({ rating: 2, text: "Very rude receptionist, unprofessional attitude." }),
      makeReview({ rating: 1, text: "Way too expensive for the quality." }),
    ];

    const signals = extractPainSignals(reviews);

    expect(signals.complaintThemes).toContain("Long wait times");
    expect(signals.complaintThemes).toContain("Poor customer service");
    expect(signals.complaintThemes).toContain("Pricing concerns");
  });

  it("does not extract themes from positive reviews", () => {
    const reviews = [
      makeReview({ rating: 5, text: "Great staff, very friendly and professional." }),
      makeReview({ rating: 5, text: "Quick and affordable." }),
    ];

    const signals = extractPainSignals(reviews);

    expect(signals.complaintThemes).toHaveLength(0);
  });

  it("truncates long excerpts at 200 characters", () => {
    const longText = "A".repeat(250);
    const reviews = [makeReview({ rating: 1, text: longText })];

    const signals = extractPainSignals(reviews);

    expect(signals.negativeExcerpts[0].length).toBe(203); // 200 + "..."
    expect(signals.negativeExcerpts[0]).toMatch(/\.\.\.$/);
  });

  it("builds a readable summary", () => {
    const reviews = [
      makeReview({ rating: 5, text: "Love it." }),
      makeReview({ rating: 2, text: "Slow and expensive for what you get." }),
    ];

    const signals = extractPainSignals(reviews);

    expect(signals.summary).toContain("3.5/5");
    expect(signals.summary).toContain("2 reviews");
    expect(signals.summary).toContain("1 negative review");
  });

  it("deduplicates complaint themes", () => {
    const reviews = [
      makeReview({ rating: 1, text: "Waited so long. So slow." }),
      makeReview({ rating: 2, text: "Waiting times are terrible here." }),
    ];

    const signals = extractPainSignals(reviews);

    const waitThemes = signals.complaintThemes.filter((t) => t === "Long wait times");
    expect(waitThemes).toHaveLength(1);
  });

  it("skips empty-text reviews in excerpts", () => {
    const reviews = [
      makeReview({ rating: 1, text: "" }),
      makeReview({ rating: 2, text: "Bad service." }),
    ];

    const signals = extractPainSignals(reviews);

    expect(signals.negativeExcerpts).toEqual(["Bad service."]);
  });

  it("detects booking/scheduling complaints", () => {
    const reviews = [
      makeReview({ rating: 2, text: "Could not book an appointment online." }),
    ];

    const signals = extractPainSignals(reviews);

    expect(signals.complaintThemes).toContain("Booking or scheduling friction");
  });

  it("detects digital experience complaints", () => {
    const reviews = [
      makeReview({ rating: 1, text: "Their website is terrible and the app crashes." }),
    ];

    const signals = extractPainSignals(reviews);

    expect(signals.complaintThemes).toContain("Digital experience gaps");
  });
});
