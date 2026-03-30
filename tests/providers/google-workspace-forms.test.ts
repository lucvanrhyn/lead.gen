import {
  buildGoogleFormBatchUpdateRequests,
  buildGoogleFormEditUrl,
  buildGoogleFormResponderUrl,
} from "@/lib/providers/google-workspace/forms";

describe("google workspace forms provider", () => {
  it("builds a Google Forms batch update payload from a diagnostic blueprint", () => {
    const requests = buildGoogleFormBatchUpdateRequests({
      form_intro: "A short diagnostic to pinpoint workflow friction.",
      closing_message: "Thanks for filling this in.",
      estimated_completion_time: "2-4 minutes",
      form_sections: [
        {
          section_name: "Basic business context",
          section_description: "A quick profile of the business and respondent.",
          questions: [
            {
              question_text: "What business are you completing this diagnostic for?",
              help_text: "Share the company name.",
              answer_type: "short_answer",
              required: true,
              options: [],
              why_this_question_exists: "Anchors the response.",
              section_name: "Basic business context",
            },
          ],
        },
        {
          section_name: "Pain points and priorities",
          section_description: "What costs the business time and money right now.",
          questions: [
            {
              question_text: "How urgent is this problem for you right now?",
              help_text: "1 is low urgency and 5 is immediate.",
              answer_type: "linear_scale",
              required: true,
              options: ["1", "2", "3", "4", "5"],
              why_this_question_exists: "Captures urgency.",
              section_name: "Pain points and priorities",
            },
          ],
        },
      ],
    });

    expect(requests[0]).toEqual(
      expect.objectContaining({
        updateFormInfo: expect.objectContaining({
          updateMask: "description",
        }),
      }),
    );
    expect(requests.some((request) => "createItem" in request)).toBe(true);
  });

  it("derives stable responder and edit URLs from the form id", () => {
    expect(buildGoogleFormResponderUrl("form-123")).toBe(
      "https://docs.google.com/forms/d/form-123/viewform",
    );
    expect(buildGoogleFormEditUrl("form-123")).toBe(
      "https://docs.google.com/forms/d/form-123/edit",
    );
  });
});
