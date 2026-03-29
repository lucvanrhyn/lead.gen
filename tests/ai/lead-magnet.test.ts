import { buildLeadMagnet } from "@/lib/ai/lead-magnet";

describe("buildLeadMagnet", () => {
  it("creates a schema-shaped lead magnet recommendation", () => {
    const leadMagnet = buildLeadMagnet({
      companyName: "Atlas Dental Group",
      primaryPain: "Inconsistent booking conversion across service lines",
      recommendedLeadMagnetType: "website conversion teardown",
      recommendedServiceAngle: "Conversion-focused website teardown for treatment pages",
      insufficientEvidence: false,
    });

    expect(leadMagnet.type).toBe("website conversion teardown");
    expect(leadMagnet.title).toMatch(/Atlas Dental Group/i);
  });
});
