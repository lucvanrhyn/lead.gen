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

export function buildGoogleFormResponderUrl(formId: string) {
  return `https://docs.google.com/forms/d/${formId}/viewform`;
}

export function buildGoogleFormEditUrl(formId: string) {
  return `https://docs.google.com/forms/d/${formId}/edit`;
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

  return {
    formId,
    responderUrl: createResponse.data.responderUri ?? buildGoogleFormResponderUrl(formId),
    editUrl: buildGoogleFormEditUrl(formId),
  };
}
