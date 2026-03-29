const draftUpdate = vi.fn();
const gmailUpsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    outreachDraft: {
      update: draftUpdate,
    },
    gmailDraftLink: {
      upsert: gmailUpsert,
    },
  },
}));

describe("approve outreach draft route", () => {
  it("marks a pending draft approved and ready for Gmail sync", async () => {
    draftUpdate.mockResolvedValueOnce({ id: "draft-1", approvalStatus: "APPROVED" });
    gmailUpsert.mockResolvedValueOnce({ id: "gmail-1", syncStatus: "READY" });

    const { POST } = await import("@/app/api/outreach-drafts/[id]/approve/route");
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "draft-1" }),
    } as { params: Promise<{ id: string }> });
    const payload = await response.json();

    expect(draftUpdate).toHaveBeenCalled();
    expect(gmailUpsert).toHaveBeenCalled();
    expect(payload.approvalStatus).toBe("APPROVED");
  });
});
