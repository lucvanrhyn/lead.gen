import { DiagnosticFormResponseStatus } from "@prisma/client";
import { z } from "zod";

export const answerTypeSchema = z.enum([
  "short_answer",
  "paragraph",
  "multiple_choice",
  "checkboxes",
  "linear_scale",
  "dropdown",
]);

export const diagnosticQuestionSchema = z.object({
  question_text: z.string(),
  help_text: z.string(),
  answer_type: answerTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()),
  section_name: z.string(),
  why_this_question_exists: z.string(),
});

export const diagnosticSectionSchema = z.object({
  section_name: z.string(),
  section_description: z.string(),
  questions: z.array(diagnosticQuestionSchema),
});

export const formUsageModeSchema = z.enum(["lead_magnet_only", "form_only", "lead_magnet_and_form"]);

export const diagnosticFormBlueprintSchema = z.object({
  form_title: z.string(),
  form_intro: z.string(),
  form_sections: z.array(diagnosticSectionSchema).length(5),
  closing_message: z.string(),
  estimated_completion_time: z.string(),
  industry: z.string(),
  primary_goal: z.string(),
  qualification_strength: z.string(),
  outreach_cta_short: z.string(),
  outreach_cta_medium: z.string(),
  usage_mode: formUsageModeSchema.default("lead_magnet_and_form"),
});

export type DiagnosticFormBlueprint = z.infer<typeof diagnosticFormBlueprintSchema>;
export type DiagnosticFormQuestion = z.infer<typeof diagnosticQuestionSchema>;

export function deriveDiagnosticResponseStatus(url?: string | null, responseSummary?: unknown) {
  if (responseSummary) {
    return DiagnosticFormResponseStatus.RESPONDED;
  }

  if (url) {
    return DiagnosticFormResponseStatus.LINK_ATTACHED;
  }

  return DiagnosticFormResponseStatus.NOT_SHARED;
}
