import {
  buildInsufficientEvidencePainHypothesis,
  painHypothesisSchema,
} from "@/lib/ai/pain-hypothesis";

describe("painHypothesisSchema", () => {
  it("accepts a valid strict pain hypothesis payload", () => {
    const parsed = painHypothesisSchema.parse({
      primary_pain: "Inconsistent booking conversion across service lines",
      secondary_pains: ["High-value treatment pages may underperform"],
      evidence: [
        {
          source_type: "website",
          source_url: "https://atlasdental.co.za",
          snippet: "same-week bookings and cosmetic smile packages",
          signal_type: "conversion_signal",
          confidence: 0.78,
        },
      ],
      business_impact: "Missed conversion opportunities likely reduce high-margin treatment bookings.",
      confidence_score: 0.72,
      recommended_service_angle: "Conversion-focused website teardown for treatment pages",
      recommended_lead_magnet_type: "website conversion teardown",
      insufficient_evidence: false,
    });

    expect(parsed.primary_pain).toMatch(/booking conversion/i);
  });
});

describe("buildInsufficientEvidencePainHypothesis", () => {
  it("returns an explicit insufficient-evidence payload", () => {
    const result = buildInsufficientEvidencePainHypothesis("Atlas Dental Group");

    expect(result.insufficient_evidence).toBe(true);
    expect(result.evidence).toEqual([]);
    expect(result.primary_pain).toMatch(/insufficient public evidence/i);
  });
});
