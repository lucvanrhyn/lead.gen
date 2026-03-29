import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { LeadTable } from "@/components/leads/lead-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

const leadRows = [
  {
    id: "lead-1",
    name: "Atlas Dental Group",
    website: "https://atlasdental.co.za",
    industry: "Dental Clinics",
    locationSummary: "Cape Town, South Africa",
    score: 79,
    scoreLabel: "79 / 100",
    painConfidence: 0.72,
    sourceConfidence: 0.86,
    contactsCount: 1,
    manualReviewRequired: false,
    status: "READY",
  },
];

const leadDetail = {
  company: {
    id: "lead-1",
    name: "Atlas Dental Group",
    website: "https://atlasdental.co.za",
    industry: "Dental Clinics",
    locationSummary: "Cape Town, South Africa",
    phone: "+27 21 555 0133",
    description: "Multi-location dental practice focused on family and cosmetic dentistry.",
    scoreLabel: "79 / 100",
    sourceConfidenceLabel: "0.86",
    manualReviewRequired: false,
    status: "READY",
  },
  contacts: [
    {
      id: "contact-1",
      fullName: "Megan Jacobs",
      title: "Practice Manager",
      email: "megan@atlasdental.co.za",
      phone: "+27 21 555 0133",
      confidenceLabel: "0.82",
    },
  ],
  technologies: [
    {
      id: "tech-1",
      name: "Cloudflare",
      category: "Infrastructure",
      confidenceLabel: "0.61",
    },
  ],
  newsMentions: [],
  painHypotheses: [
    {
      id: "pain-1",
      primaryPain: "Inconsistent booking conversion across service lines",
      confidenceLabel: "0.72",
      businessImpact: "Missed conversion opportunities likely reduce high-margin treatment bookings.",
      recommendedServiceAngle: "Conversion-focused website teardown for treatment pages",
    },
  ],
  outreachDrafts: [
    {
      id: "outreach-1",
      emailSubject1: "A quick idea for Atlas Dental bookings",
      coldEmailShort:
        "I noticed Atlas Dental highlights high-value services and quick bookings.",
    },
  ],
};

describe("LeadTable", () => {
  it("renders the lead rows with score and review state", () => {
    render(<LeadTable leads={leadRows} />);

    expect(screen.getByRole("heading", { name: /atlas dental group/i })).toBeInTheDocument();
    expect(screen.getByText("79 / 100")).toBeInTheDocument();
    expect(screen.getByText(/1 contact/i)).toBeInTheDocument();
  });
});

describe("LeadDetailView", () => {
  it("shows tabbed company details and switches to pains", async () => {
    const user = userEvent.setup();

    render(<LeadDetailView lead={leadDetail} />);

    expect(screen.getByText(/multi-location dental practice/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /pains/i }));

    expect(
      screen.getByText(/inconsistent booking conversion across service lines/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/conversion-focused website teardown/i)).toBeInTheDocument();
  });
});
