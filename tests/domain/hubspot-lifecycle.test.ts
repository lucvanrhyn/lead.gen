import {
  HUBSPOT_DEAL_STAGES,
  buildDealNoteBody,
  buildDealProperties,
  mapLeadStateToDealStage,
} from "@/lib/domain/hubspot-lifecycle";

describe("mapLeadStateToDealStage", () => {
  it("maps a known lead state to its deal stage", () => {
    expect(mapLeadStateToDealStage("qualified")).toBe(HUBSPOT_DEAL_STAGES.qualified);
  });

  it("returns the default stage when leadState is null", () => {
    expect(mapLeadStateToDealStage(null)).toBe(HUBSPOT_DEAL_STAGES.new);
  });

  it("returns the fallback for an unknown lead state", () => {
    expect(mapLeadStateToDealStage("unknown_state")).toBe(HUBSPOT_DEAL_STAGES.new);
  });

  it("accepts a custom fallback for an unknown lead state", () => {
    expect(mapLeadStateToDealStage("unknown_state", HUBSPOT_DEAL_STAGES.enriched)).toBe(
      HUBSPOT_DEAL_STAGES.enriched,
    );
  });

  it("maps all known lead states correctly", () => {
    expect(mapLeadStateToDealStage("new")).toBe("new");
    expect(mapLeadStateToDealStage("enriched")).toBe("enriched");
    expect(mapLeadStateToDealStage("scored")).toBe("scored");
    expect(mapLeadStateToDealStage("drafted")).toBe("drafted");
    expect(mapLeadStateToDealStage("sent")).toBe("sent");
    expect(mapLeadStateToDealStage("follow_up_queued")).toBe("follow_up_queued");
    expect(mapLeadStateToDealStage("replied")).toBe("replied");
    expect(mapLeadStateToDealStage("booked")).toBe("booked");
    expect(mapLeadStateToDealStage("closed_lost")).toBe("closedlost");
    expect(mapLeadStateToDealStage("do_not_contact")).toBe("do_not_contact");
  });
});

describe("buildDealProperties", () => {
  it("returns the correct dealname and dealstage", () => {
    const props = buildDealProperties({
      companyName: "Atlas Dental Group",
      stage: HUBSPOT_DEAL_STAGES.scored,
    });

    expect(props.dealname).toBe("Outreach: Atlas Dental Group");
    expect(props.dealstage).toBe(HUBSPOT_DEAL_STAGES.scored);
    expect(props.pipeline).toBe("default");
  });

  it("includes lead score and confidence in description when provided", () => {
    const props = buildDealProperties({
      companyName: "Atlas Dental Group",
      stage: HUBSPOT_DEAL_STAGES.drafted,
      leadScore: 82,
      confidence: 0.75,
      recommendedChannel: "email",
      leadMagnetUsed: "SEO audit",
    });

    expect(props.description).toContain("Lead Score: 82");
    expect(props.description).toContain("Confidence: 75%");
    expect(props.description).toContain("Channel: email");
    expect(props.description).toContain("Lead Magnet: SEO audit");
  });

  it("omits null/undefined optional fields from description", () => {
    const props = buildDealProperties({
      companyName: "Acme Corp",
      stage: HUBSPOT_DEAL_STAGES.new,
      leadScore: null,
    });

    expect(props.description).not.toContain("Lead Score");
    expect(props.description).not.toContain("Confidence");
  });
});

describe("buildDealNoteBody", () => {
  it("includes all provided context fields", () => {
    const body = buildDealNoteBody({
      companyName: "Atlas Dental Group",
      stage: HUBSPOT_DEAL_STAGES.replied,
      leadScore: 72,
      painSummary: "Relies on walk-ins",
      confidence: 0.8,
      outreachStatus: "sent",
      replyClassification: "INTERESTED",
      leadMagnetUsed: "Booking guide",
      recommendedChannel: "email",
    });

    expect(body).toContain("Atlas Dental Group");
    expect(body).toContain(HUBSPOT_DEAL_STAGES.replied);
    expect(body).toContain("Lead Score: 72");
    expect(body).toContain("Relies on walk-ins");
    expect(body).toContain("Confidence: 80%");
    expect(body).toContain("Outreach Status: sent");
    expect(body).toContain("Reply Classification: INTERESTED");
    expect(body).toContain("Booking guide");
    expect(body).toContain("email");
  });

  it("omits null/undefined optional fields", () => {
    const body = buildDealNoteBody({
      companyName: "Acme Corp",
      stage: HUBSPOT_DEAL_STAGES.new,
    });

    expect(body).toContain("Acme Corp");
    expect(body).toContain(HUBSPOT_DEAL_STAGES.new);
    expect(body).not.toContain("Lead Score");
    expect(body).not.toContain("Pain Summary");
    expect(body).not.toContain("Confidence");
  });
});
