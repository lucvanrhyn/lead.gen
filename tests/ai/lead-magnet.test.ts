import { buildLeadMagnetAssetSlug } from "@/lib/ai/lead-magnet";

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
