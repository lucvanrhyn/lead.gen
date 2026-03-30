import { google } from "googleapis";

import { type DiagnosticFormBlueprint } from "@/lib/domain/diagnostic-forms";

type FormQuestion = DiagnosticFormBlueprint["form_sections"][number]["questions"][number];

type GoogleFormsBatchUpdateRequest = {
  updateFormInfo?: {
    info: {
      description: string;
    };
    updateMask: string;
  };
  createItem?: {
    item: Record<string, unknown>;
    location: {
      index: number;
    };
  };
};

export type GoogleFormNormalizedAnswer = {
  questionId: string;
  questionText: string;
  values: string[];
};

export type GoogleFormNormalizedResponse = {
  responseId: string;
  submittedAt: string | null;
  respondentEmail?: string | null;
  answers: GoogleFormNormalizedAnswer[];
};

export type DiagnosticResponseSummary = {
  urgencyLevel?: "LOW" | "MEDIUM" | "HIGH";
  budgetReadiness?: "NOT_READY" | "EXPLORING" | "READY";
  workflowDetailDepth?: "LIGHT" | "DETAILED";
  keyPain?: string;
  respondentName?: string;
  respondentEmail?: string;
  latestResponseId?: string;
  submittedAt?: string;
  responseCount?: number;
};

export function buildGoogleFormResponderUrl(formId: string) {
  return `https://docs.google.com/forms/d/${formId}/viewform`;
}

export function buildGoogleFormEditUrl(formId: string) {
  return `https://docs.google.com/forms/d/${formId}/edit`;
}

export function extractGoogleFormId(url: string) {
  const match = url.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

function buildQuestionBody(question: FormQuestion) {
  switch (question.answer_type) {
    case "paragraph":
      return {
        textQuestion: {
          paragraph: true,
        },
      };
    case "multiple_choice":
      return {
        choiceQuestion: {
          type: "RADIO",
          options: question.options.map((option) => ({ value: option })),
          shuffle: false,
        },
      };
    case "checkboxes":
      return {
        choiceQuestion: {
          type: "CHECKBOX",
          options: question.options.map((option) => ({ value: option })),
          shuffle: false,
        },
      };
    case "dropdown":
      return {
        choiceQuestion: {
          type: "DROP_DOWN",
          options: question.options.map((option) => ({ value: option })),
          shuffle: false,
        },
      };
    case "linear_scale":
      return {
        scaleQuestion: {
          low: Number(question.options[0] ?? 1),
          high: Number(question.options.at(-1) ?? 5),
          lowLabel: question.options[0] ?? "1",
          highLabel: question.options.at(-1) ?? "5",
        },
      };
    case "short_answer":
    default:
      return {
        textQuestion: {
          paragraph: false,
        },
      };
  }
}

function buildQuestionItem(question: FormQuestion) {
  return {
    title: question.question_text,
    description: `${question.help_text}\n\nWhy this exists: ${question.why_this_question_exists}`,
    questionItem: {
      question: {
        required: question.required,
        ...buildQuestionBody(question),
      },
    },
  };
}

export function buildGoogleFormBatchUpdateRequests(
  blueprint: Pick<
    DiagnosticFormBlueprint,
    "form_intro" | "closing_message" | "estimated_completion_time" | "form_sections"
  >,
): GoogleFormsBatchUpdateRequest[] {
  const requests: GoogleFormsBatchUpdateRequest[] = [
    {
      updateFormInfo: {
        info: {
          description: `${blueprint.form_intro}\n\nEstimated completion time: ${blueprint.estimated_completion_time}\n\n${blueprint.closing_message}`,
        },
        updateMask: "description",
      },
    },
  ];

  let index = 0;

  for (const [sectionIndex, section] of blueprint.form_sections.entries()) {
    if (sectionIndex > 0) {
      requests.push({
        createItem: {
          item: {
            title: section.section_name,
            description: section.section_description,
            pageBreakItem: {},
          },
          location: { index: index++ },
        },
      });
    }

    for (const question of section.questions) {
      requests.push({
        createItem: {
          item: buildQuestionItem(question),
          location: { index: index++ },
        },
      });
    }
  }

  return requests;
}

export async function createGoogleWorkspaceDiagnosticForm(input: {
  auth: unknown;
  blueprint: DiagnosticFormBlueprint;
}) {
  const formsClient = google.forms({ version: "v1", auth: input.auth as never });
  const createResponse = await formsClient.forms.create({
    unpublished: false,
    requestBody: {
      info: {
        title: input.blueprint.form_title,
        documentTitle: input.blueprint.form_title,
      },
    },
  });

  const formId = createResponse.data.formId;

  if (!formId) {
    throw new Error("Google Forms did not return a form id.");
  }

  await formsClient.forms.batchUpdate({
    formId,
    requestBody: {
      requests: buildGoogleFormBatchUpdateRequests(input.blueprint),
    },
  });

  await formsClient.forms.setPublishSettings({
    formId,
    requestBody: {
      publishSettings: {
        publishState: {
          isPublished: true,
          isAcceptingResponses: true,
        },
      },
      updateMask: "publishState",
    },
  });

  return {
    formId,
    responderUrl: createResponse.data.responderUri ?? buildGoogleFormResponderUrl(formId),
    editUrl: buildGoogleFormEditUrl(formId),
  };
}

function normalizeAnswerValue(
  answer: {
    textAnswers?: {
      answers?: Array<{
        value?: string | null;
      }> | null;
    } | null;
  } | null | undefined,
) {
  return (
    answer?.textAnswers?.answers
      ?.map((entry) => entry.value?.trim())
      .filter((value): value is string => Boolean(value)) ?? []
  );
}

function normalizeQuestionMap(
  items:
    | Array<{
        title?: string | null;
        questionItem?: {
          question?: {
            questionId?: string | null;
          } | null;
        } | null;
      }>
    | null
    | undefined,
) {
  const questionMap = new Map<string, string>();

  for (const item of items ?? []) {
    const questionId = item.questionItem?.question?.questionId;

    if (!questionId) {
      continue;
    }

    questionMap.set(questionId, item.title?.trim() || questionId);
  }

  return questionMap;
}

function classifyUrgency(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const numeric = Number(value);

  if (!Number.isNaN(numeric)) {
    if (numeric >= 4) return "HIGH";
    if (numeric >= 3) return "MEDIUM";
    return "LOW";
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("immediate") || normalized.includes("urgent") || normalized.includes("asap")) {
    return "HIGH";
  }
  if (normalized.includes("soon") || normalized.includes("this quarter")) {
    return "MEDIUM";
  }

  return "LOW";
}

function classifyBudgetReadiness(values: string[]) {
  const normalized = values.join(" ").toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (
    normalized.includes("actively looking") ||
    normalized.includes("immediately") ||
    normalized.includes("within 30 days") ||
    normalized.includes("ready")
  ) {
    return "READY";
  }

  if (
    normalized.includes("comparing options") ||
    normalized.includes("exploring") ||
    normalized.includes("this quarter")
  ) {
    return "EXPLORING";
  }

  return "NOT_READY";
}

export function buildDiagnosticResponseSummary(
  response: GoogleFormNormalizedResponse,
): DiagnosticResponseSummary {
  const answerByQuestion = new Map(
    response.answers.map((answer) => [answer.questionText.toLowerCase(), answer.values]),
  );
  const findValues = (needle: string) =>
    Array.from(answerByQuestion.entries()).find(([question]) => question.includes(needle))?.[1] ?? [];

  const respondentValues = findValues("who is filling this in");
  const urgencyValues = findValues("how urgent");
  const readinessValues = [
    ...findValues("actively looking"),
    ...findValues("when would you want to act"),
  ];
  const painValues = [
    ...findValues("fix one bottleneck"),
    ...findValues("biggest challenge"),
    ...findValues("biggest bottleneck"),
  ];
  const workflowValues = [
    ...findValues("repetitive or manual"),
    ...findValues("specific you want reviewed"),
  ];
  const detailLength = workflowValues.join(" ").trim().length;

  return {
    urgencyLevel: classifyUrgency(urgencyValues[0]),
    budgetReadiness: classifyBudgetReadiness(readinessValues),
    workflowDetailDepth: detailLength >= 80 ? "DETAILED" : detailLength > 0 ? "LIGHT" : undefined,
    keyPain: painValues.find(Boolean),
    respondentName: respondentValues[0],
    respondentEmail: response.respondentEmail ?? undefined,
    latestResponseId: response.responseId,
    submittedAt: response.submittedAt ?? undefined,
  };
}

export async function syncGoogleWorkspaceDiagnosticResponses(input: {
  auth: unknown;
  formUrl: string;
  pageSize?: number;
}) {
  const formId = extractGoogleFormId(input.formUrl);

  if (!formId) {
    throw new Error("Diagnostic form URL does not contain a valid Google Form id.");
  }

  const formsClient = google.forms({ version: "v1", auth: input.auth as never });
  const [formResponse, responsesResponse] = await Promise.all([
    formsClient.forms.get({ formId }),
    formsClient.forms.responses.list({
      formId,
      pageSize: input.pageSize ?? 10,
    }),
  ]);

  const questionMap = normalizeQuestionMap(formResponse.data.items as never);
  const normalizedResponses = (responsesResponse.data.responses ?? [])
    .map((response) => {
      const answers = Object.entries(response.answers ?? {}).map(([questionId, answer]) => ({
        questionId,
        questionText: questionMap.get(questionId) ?? questionId,
        values: normalizeAnswerValue(answer),
      }));

      return {
        responseId: response.responseId ?? "",
        submittedAt: response.lastSubmittedTime ?? response.createTime ?? null,
        respondentEmail: response.respondentEmail ?? null,
        answers,
      } satisfies GoogleFormNormalizedResponse;
    })
    .sort((left, right) => {
      const leftTime = left.submittedAt ? new Date(left.submittedAt).getTime() : 0;
      const rightTime = right.submittedAt ? new Date(right.submittedAt).getTime() : 0;
      return rightTime - leftTime;
    });

  const latestResponse = normalizedResponses[0];

  return {
    formId,
    responseCount: normalizedResponses.length,
    responses: normalizedResponses,
    latestResponse: latestResponse
      ? {
          ...latestResponse,
          summary: {
            ...buildDiagnosticResponseSummary(latestResponse),
            responseCount: normalizedResponses.length,
          },
        }
      : null,
  };
}
