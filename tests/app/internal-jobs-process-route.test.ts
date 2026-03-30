export {};

const processQueuedDiscoveryJobs = vi.fn();
const dispatchDiscoveryProcessing = vi.fn();

vi.mock("@/lib/jobs/worker", () => ({
  processQueuedDiscoveryJobs,
}));

vi.mock("@/lib/jobs/dispatch", () => ({
  dispatchDiscoveryProcessing,
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");

  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      void callback();
    },
  };
});

describe("internal jobs process route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      CRON_SECRET: "cron-secret",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects unauthorized requests", async () => {
    const { GET } = await import("@/app/api/internal/jobs/process/route");
    const response = await GET(
      new Request("https://leadgen-indol.vercel.app/api/internal/jobs/process"),
    );

    expect(response.status).toBe(401);
    expect(processQueuedDiscoveryJobs).not.toHaveBeenCalled();
  });

  it("processes bounded work and cascades when jobs were claimed", async () => {
    processQueuedDiscoveryJobs.mockResolvedValueOnce({
      claimedCount: 1,
      processed: [],
    });
    dispatchDiscoveryProcessing.mockResolvedValueOnce({
      dispatched: true,
      status: 200,
    });

    const { GET } = await import("@/app/api/internal/jobs/process/route");
    const request = new Request(
      "https://leadgen-indol.vercel.app/api/internal/jobs/process?limit=2",
      {
        headers: {
          authorization: "Bearer cron-secret",
        },
      },
    );
    const response = await GET(request);

    await Promise.resolve();

    expect(response.status).toBe(200);
    expect(processQueuedDiscoveryJobs).toHaveBeenCalledWith({ limit: 2 });
    expect(dispatchDiscoveryProcessing).toHaveBeenCalledWith({
      request,
      limit: 2,
    });
  });

  it("does not cascade when explicitly disabled", async () => {
    processQueuedDiscoveryJobs.mockResolvedValueOnce({
      claimedCount: 1,
      processed: [],
    });

    const { GET } = await import("@/app/api/internal/jobs/process/route");
    const response = await GET(
      new Request("https://leadgen-indol.vercel.app/api/internal/jobs/process?cascade=0", {
        headers: {
          authorization: "Bearer cron-secret",
        },
      }),
    );

    await Promise.resolve();

    expect(response.status).toBe(200);
    expect(processQueuedDiscoveryJobs).toHaveBeenCalledWith({ limit: 1 });
    expect(dispatchDiscoveryProcessing).not.toHaveBeenCalled();
  });
});
