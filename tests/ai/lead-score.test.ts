import {
  generateLeadScore,
  llmLeadScoreSchema,
  scoreLeadContextDeterministic,
} from "@/lib/ai/lead-score";

describe("scoreLeadContextDeterministic", () => {
  it("returns weighted component scores and a bounded total", () => {
    const score = scoreLeadContextDeterministic({
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
    });

    expect(score.total_score).toBeGreaterThan(0);
    expect(score.total_score).toBeLessThanOrEqual(100);
    expect(score.components.contactability).toBeGreaterThan(70);
  });

  it("raises urgency and outreach confidence when a form response shows buying intent", () => {
    const score = scoreLeadContextDeterministic({
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
      formResponse: {
        status: "RESPONDED",
        urgencyLevel: "HIGH",
        budgetReadiness: "READY",
        workflowDetailDepth: "DETAILED",
      },
    });

    expect(score.components.urgency_signals).toBeGreaterThan(50);
    expect(score.components.outreach_confidence).toBeGreaterThan(70);
  });
});

describe("llmLeadScoreSchema", () => {
  it("accepts a valid LLM lead score payload", () => {
    const parsed = llmLeadScoreSchema.parse({
      total_score: 72,
      sub_scores: {
        icp_fit: { score: 80, rationale: "Strong industry fit with 5-250 employees." },
        pain_likelihood: { score: 75, rationale: "Clear pain signals observed on website." },
        reachability: { score: 70, rationale: "Decision-maker email available." },
        personalization_surface_area: {
          score: 65,
          rationale: "Rich website content with clear service descriptions.",
        },
        commercial_potential: { score: 68, rationale: "Mid-market company with growth signals." },
        urgency_trigger_signals: { score: 55, rationale: "Recent hiring for digital roles." },
      },
      confidence: 0.82,
      rationale: "Strong ICP match with reachable contacts and clear pain evidence.",
      recommended_action: "pursue",
      recommended_channel: "email",
      recommended_primary_contact_index: 0,
    });

    expect(parsed.total_score).toBe(72);
    expect(parsed.recommended_action).toBe("pursue");
    expect(parsed.confidence).toBe(0.82);
    expect(parsed.sub_scores.pain_likelihood.score).toBe(75);
  });

  it("rejects invalid recommended_action values", () => {
    expect(() =>
      llmLeadScoreSchema.parse({
        total_score: 50,
        sub_scores: {
          icp_fit: { score: 50, rationale: "test" },
          pain_likelihood: { score: 50, rationale: "test" },
          reachability: { score: 50, rationale: "test" },
          personalization_surface_area: { score: 50, rationale: "test" },
          commercial_potential: { score: 50, rationale: "test" },
          urgency_trigger_signals: { score: 50, rationale: "test" },
        },
        confidence: 0.5,
        rationale: "test",
        recommended_action: "skip",
        recommended_channel: "email",
        recommended_primary_contact_index: 0,
      }),
    ).toThrow();
  });
});

describe("generateLeadScore", () => {
  it("parses structured LLM output from the responses API", async () => {
    const mockResponse = {
      total_score: 68,
      sub_scores: {
        icp_fit: { score: 78, rationale: "Good industry match." },
        pain_likelihood: { score: 72, rationale: "Website shows conversion issues." },
        reachability: { score: 65, rationale: "Email available for primary contact." },
        personalization_surface_area: { score: 60, rationale: "Decent website content." },
        commercial_potential: { score: 70, rationale: "Growing SMB with service complexity." },
        urgency_trigger_signals: { score: 45, rationale: "No strong urgency signals." },
      },
      confidence: 0.76,
      rationale: "Solid lead with clear pain and reachable decision-maker.",
      recommended_action: "pursue",
      recommended_channel: "email",
      recommended_primary_contact_index: 0,
    };

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(mockResponse),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await generateLeadScore(
      {
        companyName: "Acme Dental Group",
        website: "https://acmedental.example.com",
        industry: "dental practice",
        employeeCount: 35,
        contacts: [
          {
            fullName: "Jane Smith",
            title: "Practice Manager",
            email: "jane@acmedental.example.com",
            phone: null,
            seniority: "manager",
            decisionMakerConfidence: 0.78,
          },
        ],
        painHypothesis: {
          primary_pain: "Low online booking conversion rate",
          confidence_score: 0.72,
          business_impact: "Missed high-margin treatment bookings.",
          insufficient_evidence: false,
        },
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
      },
    );

    expect(result.total_score).toBe(68);
    expect(result.recommended_action).toBe("pursue");
    expect(result.confidence).toBe(0.76);
    expect(result.sub_scores.icp_fit.score).toBe(78);
  });
});
