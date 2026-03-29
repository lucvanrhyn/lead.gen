import { render, screen } from "@testing-library/react";

const findAsset = vi.fn();
const incrementAsset = vi.fn();
const claimFollowUp = vi.fn();
const createEvent = vi.fn();
const createFollowUp = vi.fn();

const notFound = vi.fn(() => {
  throw new Error("not-found");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    leadMagnetAsset: {
      findUnique: findAsset,
      update: incrementAsset,
      updateMany: claimFollowUp,
    },
    outreachEngagementEvent: {
      create: createEvent,
    },
    outreachDraft: {
      create: createFollowUp,
    },
  },
}));

vi.mock("@/lib/ai/outreach", () => ({
  buildFollowUpDraft: vi.fn(() => ({
    email_subject_1: "Atlas Dental Group asset follow-up",
    email_subject_2: "A quick note on the asset view",
    cold_email_short: "Saw the asset got viewed.",
    cold_email_medium: "It looks like the asset was viewed, so I wanted to follow up.",
    linkedin_message_safe: "Saw the asset was viewed.",
    follow_up_1: "Following up after the asset view.",
    follow_up_2: "Happy to turn the asset into a next step.",
    follow_up_reason: "asset_view",
  })),
}));

describe("AssetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it(
    "renders a hosted asset and logs the asset view",
    async () => {
      findAsset.mockResolvedValueOnce({
        id: "asset-1",
        slug: "atlas-demo",
        companyId: "company-1",
        leadMagnetId: "magnet-1",
        outreachDraft: {
          id: "draft-1",
          companyId: "company-1",
          contactId: "contact-1",
          sequenceStep: 1,
          contact: {
            firstName: "Megan",
            fullName: "Megan Jacobs",
            email: "megan@atlasdental.co.za",
          },
          company: { name: "Atlas Dental Group" },
        },
        company: { name: "Atlas Dental Group" },
        headline: "Atlas Dental Booking Funnel Teardown",
        intro:
          "A focused review of where booking friction may be leaking high-value treatment demand.",
        status: "ACTIVE",
        viewCount: 0,
        firstViewedAt: null,
        lastViewedAt: null,
        followUpCreatedAt: null,
        diagnosticFormUrl: "https://forms.gle/example",
      });
      incrementAsset.mockResolvedValueOnce({ id: "asset-1", viewCount: 1 });
      claimFollowUp.mockResolvedValueOnce({ count: 1 });
      createEvent.mockResolvedValueOnce({ id: "event-1" });
      createFollowUp.mockResolvedValueOnce({ id: "draft-2" });

      const AssetPage = (await import("@/app/assets/[slug]/page")).default;
      const page = await AssetPage({ params: Promise.resolve({ slug: "atlas-demo" }) });

      render(page);

      expect(screen.getByText(/atlas dental booking funnel teardown/i)).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /request a tailored version/i }),
      ).toBeInTheDocument();
      expect(createEvent).toHaveBeenCalled();
      expect(createFollowUp).toHaveBeenCalled();
    },
    30000,
  );
});
