export {};

const runCompanyFullPipeline = vi.fn();

vi.mock("@/lib/orchestration/full-pipeline", () => ({
  runCompanyFullPipeline,
}));

describe("lead full pipeline route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("runs the orchestration pipeline and returns stage details", async () => {
    runCompanyFullPipeline.mockResolvedValueOnce({
      status: "PARTIAL",
      stages: [
        {
          stage: "enrich",
          status: "SUCCEEDED",
        },
        {
          stage: "outreach",
          status: "PARTIAL",
          error: "No valid contacts with email were available for draft generation.",
        },
      ],
      error: undefined,
    });

    const { POST } = await import("@/app/api/leads/[id]/pipeline/route");
    const response = await POST(
      new Request("https://leadgen-indol.vercel.app/api/leads/lead-1/pipeline", {
        method: "POST",
      }),
      {
        params: Promise.resolve({ id: "lead-1" }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "PARTIAL",
      stages: [
        {
          stage: "enrich",
          status: "SUCCEEDED",
        },
        {
          stage: "outreach",
          status: "PARTIAL",
          error: "No valid contacts with email were available for draft generation.",
        },
      ],
      error: undefined,
    });
    expect(runCompanyFullPipeline).toHaveBeenCalledWith("lead-1");
  });
});
