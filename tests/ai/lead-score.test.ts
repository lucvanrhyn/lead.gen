import { scoreLeadContext } from "@/lib/ai/lead-score";

describe("scoreLeadContext", () => {
  it("returns weighted component scores and a bounded total", () => {
    const score = scoreLeadContext({
      hasIndustry: true,
      employeeCount: 48,
      hasWebsite: true,
      hasPhone: true,
      hasLocation: true,
      contacts: [
        {
          hasEmail: true,
          hasPhone: true,
          decisionMakerConfidence: 0.82,
        },
      ],
      painConfidence: 0.72,
      painEvidenceCount: 2,
      insufficientEvidence: false,
      hasTechnologyProfile: true,
      newsMentionsCount: 1,
    });

    expect(score.total_score).toBeGreaterThan(0);
    expect(score.total_score).toBeLessThanOrEqual(100);
    expect(score.components.contactability).toBeGreaterThan(70);
  });

  it("raises urgency and outreach confidence when a form response shows buying intent", () => {
    const score = scoreLeadContext({
      hasIndustry: true,
      employeeCount: 48,
      hasWebsite: true,
      hasPhone: true,
      hasLocation: true,
      contacts: [
        {
          hasEmail: true,
          hasPhone: true,
          decisionMakerConfidence: 0.82,
        },
      ],
      painConfidence: 0.72,
      painEvidenceCount: 2,
      insufficientEvidence: false,
      hasTechnologyProfile: true,
      newsMentionsCount: 1,
      formResponse: {
        status: "RESPONDED",
        urgencyLevel: "HIGH",
        budgetReadiness: "READY",
        workflowDetailDepth: "DETAILED",
      },
    });

    expect(score.components.urgency_signals).toBeGreaterThan(70);
    expect(score.components.outreach_confidence).toBeGreaterThan(80);
  });
});
