describe("discovery processing dispatch", () => {
  const originalEnv = process.env;
  const fetchMock = vi.fn();
  const { processQueuedDiscoveryJobs } = vi.hoisted(() => ({
    processQueuedDiscoveryJobs: vi.fn(),
  }));

  vi.mock("@/lib/jobs/worker", () => ({
    processQueuedDiscoveryJobs,
  }));

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: "cron-secret",
    };
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("dispatches the internal processor against the current request origin", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { dispatchDiscoveryProcessing } = await import("@/lib/jobs/dispatch");
    const response = await dispatchDiscoveryProcessing({
      request: new Request("https://leadgen-indol.vercel.app/leads"),
    });

    expect(response).toEqual({
      dispatched: true,
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://leadgen-indol.vercel.app/api/internal/jobs/process?limit=1&cascade=1",
      {
        method: "GET",
        headers: {
          authorization: "Bearer cron-secret",
        },
        cache: "no-store",
      },
    );
  });

  it("falls back to direct processing when the cron secret is unavailable", async () => {
    process.env = {
      ...originalEnv,
    };
    processQueuedDiscoveryJobs.mockResolvedValueOnce({
      claimedCount: 1,
      processed: [],
    });

    const { dispatchDiscoveryProcessing } = await import("@/lib/jobs/dispatch");
    const response = await dispatchDiscoveryProcessing({
      origin: "https://leadgen-indol.vercel.app",
    });

    expect(response).toEqual({
      dispatched: true,
      mode: "direct",
      claimedCount: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(processQueuedDiscoveryJobs).toHaveBeenCalledWith({ limit: 1 });
  });
});
