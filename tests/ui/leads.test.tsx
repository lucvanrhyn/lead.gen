import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { LeadTable } from "@/components/leads/lead-table";
import { ApprovalQueue } from "@/components/leads/approval-queue";
import { GoogleWorkspaceStatus } from "@/components/leads/google-workspace-status";

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
    approvalStatus: "PENDING_APPROVAL",
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
    hasWebsite: true,
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
  leadMagnets: [
    {
      id: "magnet-1",
      title: "Atlas Dental Booking Funnel Teardown",
      type: "website conversion teardown",
      summary: "A focused review of homepage-to-booking friction for cosmetic and implant leads.",
      whyItMatchesTheLead:
        "The site positions high-value services prominently, which creates a strong case for conversion optimization.",
      suggestedDeliveryFormat: "5-slide PDF",
    },
  ],
  outreachDrafts: [
    {
      id: "outreach-1",
      emailSubject1: "A quick idea for Atlas Dental bookings",
      emailSubject2: "One conversion win for your treatment pages",
      coldEmailShort:
        "I noticed Atlas Dental highlights high-value services and quick bookings.",
      coldEmailMedium:
        "I spent some time reviewing how Atlas Dental presents cosmetic and implant services online.",
      followUp1:
        "Following up in case a short conversion teardown for Atlas Dental's treatment pages would be useful.",
      approvalStatus: "PENDING_APPROVAL",
      gmailSyncStatus: "READY",
      sheetSyncStatus: "NOT_READY",
    },
  ],
  diagnosticForms: [
    {
      id: "form-1",
      formTitle: "Atlas Dental Workflow Diagnostic",
      estimatedCompletionTime: "2-4 minutes",
      industry: "Dental Clinics",
      outreachCtaShort: "I put together a short 2-minute workflow diagnostic for dental clinics.",
      googleFormUrl: "https://forms.gle/example",
      responseStatus: "LINK_ATTACHED",
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

    await user.click(screen.getByRole("button", { name: /^pains$/i }));

    expect(
      screen.getByText(/inconsistent booking conversion across service lines/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/conversion-focused website teardown/i)).toBeInTheDocument();
  });

  it("shows the lead magnet inside outreach content", async () => {
    const user = userEvent.setup();

    render(<LeadDetailView lead={leadDetail} />);

    await user.click(screen.getByRole("button", { name: /^outreach$/i }));

    expect(screen.getByText(/atlas dental booking funnel teardown/i)).toBeInTheDocument();
    expect(screen.getByText(/a quick idea for atlas dental bookings/i)).toBeInTheDocument();
  });

  it("shows the latest diagnostic form blueprint and generate action", async () => {
    const user = userEvent.setup();

    render(<LeadDetailView lead={leadDetail} />);

    expect(screen.getByRole("button", { name: /generate form/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^outreach$/i }));

    expect(screen.getByText(/atlas dental workflow diagnostic/i)).toBeInTheDocument();
    expect(screen.getByText(/2-minute workflow diagnostic/i)).toBeInTheDocument();
  });
});

describe("ApprovalQueue", () => {
  it("renders pending drafts with sync badges", () => {
    render(
      <ApprovalQueue
        items={[
          {
            draftId: "outreach-1",
            leadId: "lead-1",
            companyName: "Atlas Dental Group",
            contactName: "Megan Jacobs",
            emailSubject: "A quick idea for Atlas Dental bookings",
            approvalStatus: "PENDING_APPROVAL",
            gmailSyncStatus: "READY",
            sheetSyncStatus: "NOT_READY",
          },
        ]}
        summary={{
          pendingApprovalCount: 1,
          approvedCount: 0,
          syncedDraftCount: 0,
        }}
        workspaceConnected={false}
      />,
    );

    expect(screen.getByText(/approval queue/i)).toBeInTheDocument();
    expect(screen.getAllByText(/pending approval/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/gmail ready/i)).toBeInTheDocument();
  });

  it("shows Gmail and Sheets actions for approved drafts when workspace is connected", () => {
    render(
      <ApprovalQueue
        items={[
          {
            draftId: "outreach-1",
            leadId: "lead-1",
            companyName: "Atlas Dental Group",
            contactName: "Megan Jacobs",
            emailSubject: "A quick idea for Atlas Dental bookings",
            approvalStatus: "APPROVED",
            gmailSyncStatus: "READY",
            sheetSyncStatus: "NOT_READY",
          },
        ]}
        summary={{
          pendingApprovalCount: 0,
          approvedCount: 1,
          syncedDraftCount: 0,
        }}
        workspaceConnected
      />,
    );

    expect(screen.getByRole("button", { name: /create gmail draft/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync to sheets/i })).toBeInTheDocument();
  });
});

describe("GoogleWorkspaceStatus", () => {
  it("renders the connected workspace summary", () => {
    render(
      <GoogleWorkspaceStatus
        workspace={{
          status: "CONNECTED",
          canStartOAuth: true,
          connectedEmail: "operator@example.com",
          title: "Google Workspace connected",
          description: "Approved drafts can now create Gmail drafts and sync to your operator sheet.",
        }}
      />,
    );

    expect(screen.getByText(/google workspace connected/i)).toBeInTheDocument();
    expect(screen.getByText(/operator@example.com/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reconnect google/i })).toBeInTheDocument();
  });
});
