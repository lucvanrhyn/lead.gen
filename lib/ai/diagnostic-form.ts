import { z } from "zod";

import {
  type DiagnosticFormBlueprint,
  diagnosticFormBlueprintSchema,
  type DiagnosticFormQuestion,
} from "@/lib/domain/diagnostic-forms";

type DiagnosticFormInput = {
  companyName: string;
  industry?: string | null;
  primaryPain: string;
  serviceAngle: string;
};

function normalizeIndustry(industry?: string | null) {
  return industry?.trim().toLowerCase() ?? "general services";
}

function buildQuestion(
  sectionName: string,
  question: Omit<DiagnosticFormQuestion, "section_name">,
): DiagnosticFormQuestion {
  return {
    ...question,
    section_name: sectionName,
  };
}

function getIndustrySpecificQuestions(industry: string) {
  const normalized = normalizeIndustry(industry);

  if (normalized.includes("clinic") || normalized.includes("dental")) {
    return [
      {
        section: "Current operational situation",
        question_text: "Where does your booking flow feel slowest right now?",
        help_text: "For example: website bookings, front-desk follow-up, reminders, or cancellations.",
        answer_type: "multiple_choice" as const,
        required: true,
        options: ["New bookings", "Reminders", "Cancellations", "Follow-ups", "Unsure"],
        why_this_question_exists:
          "This surfaces where clinic revenue and admin time are leaking in the patient journey.",
      },
    ];
  }

  if (normalized.includes("law")) {
    return [
      {
        section: "Current operational situation",
        question_text: "Where does matter intake or document handling slow down most often?",
        help_text: "Think about new enquiries, follow-up, document collection, or handoff between staff.",
        answer_type: "checkboxes" as const,
        required: true,
        options: [
          "New matter intake",
          "Document collection",
          "Client follow-up",
          "Response times",
          "Matter tracking",
        ],
        why_this_question_exists:
          "This identifies the operational friction points most relevant to law firms and related service design.",
      },
    ];
  }

  if (normalized.includes("account")) {
    return [
      {
        section: "Pain points and priorities",
        question_text: "Which part of client document collection causes the most delay?",
        help_text: "Choose the biggest blocker in getting complete information on time.",
        answer_type: "multiple_choice" as const,
        required: true,
        options: ["Initial requests", "Reminders", "Missing documents", "Reporting handoff", "Unsure"],
        why_this_question_exists:
          "This pinpoints reporting and client reminder bottlenecks that affect accountants directly.",
      },
    ];
  }

  if (normalized.includes("estate")) {
    return [
      {
        section: "Pain points and priorities",
        question_text: "Where do promising leads or viewings slip most often?",
        help_text: "Select the handoff where opportunities go cold.",
        answer_type: "multiple_choice" as const,
        required: true,
        options: ["Lead response speed", "Viewing coordination", "Follow-up", "Admin handoff", "Unsure"],
        why_this_question_exists:
          "This clarifies leakage in lead response and viewing coordination for estate agents.",
      },
    ];
  }

  if (normalized.includes("home") || normalized.includes("service")) {
    return [
      {
        section: "Current operational situation",
        question_text: "Which operational handoff creates the most missed work right now?",
        help_text: "Think about quote requests, scheduling, dispatch, or missed enquiries.",
        answer_type: "multiple_choice" as const,
        required: true,
        options: ["Quote requests", "Scheduling", "Dispatch", "Missed enquiries", "Follow-up"],
        why_this_question_exists:
          "This helps home-service businesses expose the operational chokepoint closest to lost revenue.",
      },
    ];
  }

  return [];
}

export function buildDiagnosticFormBlueprint(input: DiagnosticFormInput): DiagnosticFormBlueprint {
  const industry = input.industry?.trim() || "General Services";
  const questionsBySection = new Map<string, DiagnosticFormQuestion[]>();

  const add = (sectionName: string, question: Omit<DiagnosticFormQuestion, "section_name">) => {
    const questions = questionsBySection.get(sectionName) ?? [];
    questions.push(buildQuestion(sectionName, question));
    questionsBySection.set(sectionName, questions);
  };

  add("Basic business context", {
    question_text: "What business are you completing this diagnostic for?",
    help_text: "Share the company name so the recommendations stay tied to the right operation.",
    answer_type: "short_answer",
    required: true,
    options: [],
    why_this_question_exists: "This anchors the response to the right business record.",
  });
  add("Basic business context", {
    question_text: "Who is filling this in, and what is your role?",
    help_text: "Include your name and role in the business.",
    answer_type: "short_answer",
    required: true,
    options: [],
    why_this_question_exists: "This tells us whether the respondent sees strategy, operations, or day-to-day execution.",
  });
  add("Current operational situation", {
    question_text: "What area of the business feels most inefficient right now?",
    help_text: "Pick the area where friction shows up most often.",
    answer_type: "multiple_choice",
    required: true,
    options: ["Lead handling", "Admin workflow", "Follow-up", "Reporting", "Team coordination"],
    why_this_question_exists: "This isolates the main operating zone where improvement is needed.",
  });
  add("Current operational situation", {
    question_text: "What tasks are still repetitive or manual for your team?",
    help_text: "List anything your team repeats often or tracks manually.",
    answer_type: "paragraph",
    required: true,
    options: [],
    why_this_question_exists: "This reveals automation and workflow opportunities tied to the pain hypothesis.",
  });
  add("Pain points and priorities", {
    question_text: "If you could fix one bottleneck first, what would it be?",
    help_text: "Choose the issue that would create the biggest practical win.",
    answer_type: "paragraph",
    required: true,
    options: [],
    why_this_question_exists: "This identifies the lead's top priority and sharpens follow-up relevance.",
  });
  add("Pain points and priorities", {
    question_text: "How urgent is this problem for you right now?",
    help_text: "A quick signal helps us understand whether this is immediate or later-stage.",
    answer_type: "linear_scale",
    required: true,
    options: ["1", "2", "3", "4", "5"],
    why_this_question_exists: "This gives a direct urgency signal for qualification and follow-up timing.",
  });
  add("Lead qualification / readiness", {
    question_text: "Are you actively looking for a solution or just assessing options right now?",
    help_text: "Choose the option closest to your current mindset.",
    answer_type: "multiple_choice",
    required: true,
    options: ["Actively looking", "Comparing options", "Planning ahead", "Just assessing"],
    why_this_question_exists: "This gauges readiness without making the form feel like a sales trap.",
  });
  add("Lead qualification / readiness", {
    question_text: "If a practical solution made sense, when would you want to act?",
    help_text: "A rough timeline is enough.",
    answer_type: "dropdown",
    required: true,
    options: ["Immediately", "Within 30 days", "This quarter", "Later this year", "Unsure"],
    why_this_question_exists: "This helps qualify timing and sequence any follow-up appropriately.",
  });
  add("Optional open text", {
    question_text: "Is there anything specific you want reviewed or improved?",
    help_text: "Mention any workflow, system, or handoff you want us to look at closely.",
    answer_type: "paragraph",
    required: false,
    options: [],
    why_this_question_exists: "This catches bespoke workflow context that does not fit a fixed choice question.",
  });

  for (const question of getIndustrySpecificQuestions(industry)) {
    add(question.section, {
      question_text: question.question_text,
      help_text: question.help_text,
      answer_type: question.answer_type,
      required: question.required,
      options: question.options,
      why_this_question_exists: question.why_this_question_exists,
    });
  }

  const orderedSections = [
    {
      section_name: "Basic business context",
      section_description: "A quick profile of the business and respondent.",
    },
    {
      section_name: "Current operational situation",
      section_description: "How the work currently flows and where friction appears.",
    },
    {
      section_name: "Pain points and priorities",
      section_description: "What costs the business time, money, and momentum right now.",
    },
    {
      section_name: "Lead qualification / readiness",
      section_description: "How ready the business is to act on a practical recommendation.",
    },
    {
      section_name: "Optional open text",
      section_description: "Anything specific the respondent wants reviewed further.",
    },
  ].map((section) => ({
    ...section,
    questions: questionsBySection.get(section.section_name) ?? [],
  }));

  return diagnosticFormBlueprintSchema.parse({
    form_title: `${input.companyName} Workflow Diagnostic`,
    form_intro: `I put this together as a short diagnostic to pinpoint where ${input.primaryPain.toLowerCase()} may be creating friction inside ${input.companyName}.`,
    form_sections: orderedSections,
    closing_message:
      "Thanks for filling this out. This gives us enough context to make the next recommendation practical instead of generic.",
    estimated_completion_time: "2-4 minutes",
    industry,
    primary_goal: input.serviceAngle,
    qualification_strength: "medium",
    outreach_cta_short: `I put together a short 2-minute workflow diagnostic for ${industry.toLowerCase()} businesses.`,
    outreach_cta_medium: `I made a quick bottleneck assessment form tailored for businesses dealing with ${input.primaryPain.toLowerCase()}, so I can recommend the next step based on real workflow detail.`,
    usage_mode: "lead_magnet_and_form",
  });
}

export async function persistDiagnosticFormBlueprint(input: {
  companyId: string;
  painHypothesisId?: string;
  blueprint: DiagnosticFormBlueprint;
}) {
  const { db } = await import("@/lib/db");

  return db.diagnosticFormBlueprint.create({
    data: {
      companyId: input.companyId,
      painHypothesisId: input.painHypothesisId,
      industry: input.blueprint.industry,
      primaryGoal: input.blueprint.primary_goal,
      qualificationStrength: input.blueprint.qualification_strength,
      estimatedCompletionTime: input.blueprint.estimated_completion_time,
      formTitle: input.blueprint.form_title,
      formIntro: input.blueprint.form_intro,
      closingMessage: input.blueprint.closing_message,
      outreachCtaShort: input.blueprint.outreach_cta_short,
      outreachCtaMedium: input.blueprint.outreach_cta_medium,
      formSections: input.blueprint.form_sections,
      rawPayload: input.blueprint,
    },
  });
}

export const diagnosticFormResponseSummarySchema = z.object({
  urgencyLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  budgetReadiness: z.enum(["NOT_READY", "EXPLORING", "READY"]).optional(),
  workflowDetailDepth: z.enum(["LIGHT", "DETAILED"]).optional(),
  keyPain: z.string().optional(),
  respondentName: z.string().optional(),
  respondentEmail: z.string().optional(),
  latestResponseId: z.string().optional(),
  submittedAt: z.string().optional(),
  responseCount: z.number().optional(),
});
