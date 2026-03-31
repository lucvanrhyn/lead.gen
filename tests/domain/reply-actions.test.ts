import { determineReplyActions } from "@/lib/domain/reply-actions";

describe("determineReplyActions", () => {
  it("INTERESTED → stopFollowUps=true, generateReplyDraft=true, leadState=qualified", () => {
    const result = determineReplyActions("INTERESTED");

    expect(result.stopFollowUps).toBe(true);
    expect(result.generateReplyDraft).toBe(true);
    expect(result.leadStateUpdate).toBe("qualified");
    expect(result.flagForReview).toBe(false);
    expect(result.adjustFollowUpTiming).toBe(false);
  });

  it("NOT_INTERESTED → stopFollowUps=true, leadState=closed_lost", () => {
    const result = determineReplyActions("NOT_INTERESTED");

    expect(result.stopFollowUps).toBe(true);
    expect(result.leadStateUpdate).toBe("closed_lost");
    expect(result.generateReplyDraft).toBe(false);
  });

  it("BOUNCED → stopFollowUps=true", () => {
    const result = determineReplyActions("BOUNCED");

    expect(result.stopFollowUps).toBe(true);
    expect(result.leadStateUpdate).toBeNull();
    expect(result.generateReplyDraft).toBe(false);
  });

  it("REFERRAL → flagForReview=true", () => {
    const result = determineReplyActions("REFERRAL");

    expect(result.flagForReview).toBe(true);
    expect(result.generateReplyDraft).toBe(true);
    expect(result.stopFollowUps).toBe(false);
  });

  it("OUT_OF_OFFICE → adjustFollowUpTiming=true, stopFollowUps=false", () => {
    const result = determineReplyActions("OUT_OF_OFFICE");

    expect(result.adjustFollowUpTiming).toBe(true);
    expect(result.stopFollowUps).toBe(false);
    expect(result.leadStateUpdate).toBeNull();
    expect(result.generateReplyDraft).toBe(false);
  });
});
