import {
  checkFollowUpStopConditions,
  FOLLOW_UP_SEQUENCE,
} from "@/lib/domain/follow-up-scheduler";

describe("FOLLOW_UP_SEQUENCE", () => {
  it("has exactly 3 entries", () => {
    expect(FOLLOW_UP_SEQUENCE).toHaveLength(3);
  });

  it("has correct step/delay/angle for each entry", () => {
    expect(FOLLOW_UP_SEQUENCE[0]).toEqual({ step: 2, delayDays: 3, angle: "bump" });
    expect(FOLLOW_UP_SEQUENCE[1]).toEqual({ step: 3, delayDays: 7, angle: "value_add" });
    expect(FOLLOW_UP_SEQUENCE[2]).toEqual({ step: 4, delayDays: 12, angle: "soft_close" });
  });

  it("has delay days in ascending order", () => {
    const delays = FOLLOW_UP_SEQUENCE.map((e) => e.delayDays);
    const sorted = [...delays].sort((a, b) => a - b);
    expect(delays).toEqual(sorted);
  });
});

describe("checkFollowUpStopConditions", () => {
  const buildDb = (overrides: Partial<ReturnType<typeof buildDefaultDb>> = {}) => ({
    ...buildDefaultDb(),
    ...overrides,
  });

  function buildDefaultDb() {
    return {
      outreachEngagementEvent: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      company: {
        findUnique: vi.fn().mockResolvedValue({ leadState: "prospect" }),
      },
      outreachDraft: {
        findUnique: vi.fn().mockResolvedValue({ approvalStatus: "PENDING_APPROVAL" }),
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      replyAnalysis: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns shouldStop=true when a REPLY engagement event exists on the parent draft", async () => {
    const db = buildDb({
      outreachEngagementEvent: {
        findFirst: vi.fn().mockResolvedValue({ id: "event-1" }),
      },
    });

    const result = await checkFollowUpStopConditions(
      "company-1",
      "draft-1",
      db as never,
    );

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe("reply_received");
  });

  it("returns shouldStop=true when company leadState is do_not_contact", async () => {
    const db = buildDb({
      company: {
        findUnique: vi.fn().mockResolvedValue({ leadState: "do_not_contact" }),
      },
    });

    const result = await checkFollowUpStopConditions(
      "company-1",
      "draft-1",
      db as never,
    );

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe("company_lead_state:do_not_contact");
  });

  it("returns shouldStop=true when company leadState is closed_lost", async () => {
    const db = buildDb({
      company: {
        findUnique: vi.fn().mockResolvedValue({ leadState: "closed_lost" }),
      },
    });

    const result = await checkFollowUpStopConditions(
      "company-1",
      "draft-1",
      db as never,
    );

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe("company_lead_state:closed_lost");
  });

  it("returns shouldStop=true when the parent draft was REJECTED", async () => {
    const db = buildDb({
      outreachDraft: {
        findUnique: vi.fn().mockResolvedValue({ approvalStatus: "REJECTED" }),
        create: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    });

    const result = await checkFollowUpStopConditions(
      "company-1",
      "draft-1",
      db as never,
    );

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe("parent_draft_rejected");
  });

  it("returns shouldStop=true when a ReplyAnalysis has shouldStopFollowUps=true", async () => {
    const db = buildDb({
      replyAnalysis: {
        findFirst: vi.fn().mockResolvedValue({ id: "analysis-1" }),
      },
    });

    const result = await checkFollowUpStopConditions(
      "company-1",
      "draft-1",
      db as never,
    );

    expect(result.shouldStop).toBe(true);
    expect(result.reason).toBe("reply_analysis_stop_flag");
  });

  it("returns shouldStop=false when all conditions are clear", async () => {
    const db = buildDb();

    const result = await checkFollowUpStopConditions(
      "company-1",
      "draft-1",
      db as never,
    );

    expect(result.shouldStop).toBe(false);
    expect(result.reason).toBeNull();
  });
});
