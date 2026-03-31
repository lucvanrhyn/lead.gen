import { buildLeadMagnet, buildLeadMagnetAssetSlug, leadMagnetSchema } from "@/lib/ai/lead-magnet";

describe("buildLeadMagnetAssetSlug", () => {
  it("creates a stable slug for a hosted lead magnet asset", () => {
    const slug = buildLeadMagnetAssetSlug({
      companyName: "Atlas Dental Group",
      leadMagnetTitle: "Atlas Dental Booking Funnel Teardown",
      outreachDraftId: "draft-1",
    });

    expect(slug).toMatch(/^atlas-dental-group-atlas-dental-booking-funnel-teardown-/);
  });
});

describe("leadMagnetSchema", () => {
  it("accepts a valid payload including new fields", () => {
    const parsed = leadMagnetSchema.parse({
      title: "Atlas Dental Booking Flow Audit",
      type: "booking-flow audit",
      summary: "A review of the Atlas Dental online booking journey.",
      why_it_matches_the_lead: "Their booking flow has multiple drop-off points.",
      suggested_delivery_format: "Annotated Loom + 1-page PDF",
      estimated_time_to_prepare: "45 minutes",
      suggested_outreach_mention:
        "I put together a quick booking flow review for your practice — spotted a couple of things that might be costing you appointments.",
      content_body:
        "Outline: 1. Homepage CTA audit 2. Booking widget UX 3. Confirmation flow 4. Follow-up sequence gaps",
    });

    expect(parsed.suggested_outreach_mention).toMatch(/booking flow review/i);
    expect(parsed.content_body).toMatch(/Homepage CTA/i);
  });
});

describe("buildLeadMagnet", () => {
  it("returns the insufficient-evidence fallback with new fields populated", async () => {
    const result = await buildLeadMagnet({
      companyName: "Atlas Dental Group",
      industry: "dental",
      primaryPain: "Unknown",
      recommendedLeadMagnetType: "research follow-up",
      recommendedServiceAngle: "General",
      insufficientEvidence: true,
    });

    expect(result.type).toBe("research follow-up");
    expect(result.suggested_outreach_mention).toMatch(/Atlas Dental Group/);
    expect(result.content_body).toBe("");
  });

  it("calls the OpenAI API and returns a parsed lead magnet with new fields", async () => {
    const mockPayload = {
      title: "Bright Smiles Booking Flow Audit",
      type: "booking-flow audit",
      summary: "A focused review of Bright Smiles' online booking conversion funnel.",
      why_it_matches_the_lead: "Their booking page has no clear CTA above the fold.",
      suggested_delivery_format: "Annotated Loom + 1-page PDF",
      estimated_time_to_prepare: "45 minutes",
      suggested_outreach_mention:
        "I put together a quick booking flow review for your practice — spotted a couple of things that might be costing you appointments.",
      content_body:
        "1. Homepage CTA audit\n2. Booking widget UX review\n3. Confirmation flow\n4. Follow-up sequence gaps\n5. Mobile responsiveness check",
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
                  text: JSON.stringify(mockPayload),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await buildLeadMagnet(
      {
        companyName: "Bright Smiles Dental",
        industry: "dental",
        primaryPain: "Losing bookings from an unclear online booking flow",
        recommendedLeadMagnetType: "booking-flow audit",
        recommendedServiceAngle: "Conversion optimisation for healthcare booking flows",
        insufficientEvidence: false,
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
      },
    );

    expect(result.suggested_outreach_mention).toMatch(/booking flow review/i);
    expect(result.content_body).toMatch(/Homepage CTA/i);
    expect(result.title).toBe("Bright Smiles Booking Flow Audit");
  });

  it("passes playbook context in the request body when provided", async () => {
    const mockPayload = {
      title: "Peak Performance Checklist",
      type: "checklist",
      summary: "An operational checklist for gym management.",
      why_it_matches_the_lead: "Aligns with gym's operational pain points.",
      suggested_delivery_format: "1-page PDF checklist",
      estimated_time_to_prepare: "25 minutes",
      suggested_outreach_mention: "I put together a quick ops checklist for gyms like yours.",
      content_body:
        "1. Member onboarding\n2. Class scheduling\n3. Equipment maintenance\n4. Retention follow-up\n5. Staff briefing",
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
                  text: JSON.stringify(mockPayload),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    await buildLeadMagnet(
      {
        companyName: "Peak Performance Gym",
        industry: "fitness",
        primaryPain: "Manual operations eating into staff time",
        recommendedLeadMagnetType: "checklist",
        recommendedServiceAngle: "Automation for fitness businesses",
        insufficientEvidence: false,
      },
      {
        apiKey: "openai_test_key",
        fetchFn,
        playbook: {
          preferredLeadMagnetTypes: ["checklist", "scorecard"],
          offerAngles: ["automation", "time savings"],
          messagingFocus: "Helping gym owners reclaim their time",
        },
      },
    );

    const requestBody = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string);
    const userContent: string = requestBody.input.find(
      (m: { role: string }) => m.role === "user",
    ).content;

    expect(userContent).toMatch(/Industry playbook context/);
    expect(userContent).toMatch(/checklist, scorecard/);
    expect(userContent).toMatch(/Helping gym owners reclaim their time/);
  });
});
