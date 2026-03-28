import { z } from "zod";

export const defaultEnrichmentStages = [
  "google_places_discovery",
  "apollo_company_enrichment",
  "apollo_people_enrichment",
  "firecrawl_extraction",
  "pain_hypothesis_generation",
] as const;

export const companySeedGraphSchema = z.object({
  company: z.object({
    name: z.string().min(1),
    website: z.url().optional(),
    industry: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
  }),
  contacts: z
    .array(
      z.object({
        fullName: z.string().min(1),
        title: z.string().min(1),
        email: z.email().optional(),
        phone: z.string().min(5).optional(),
      }),
    )
    .default([]),
  sourceEvent: z.object({
    provider: z.enum(["manual_seed", "google_places", "apollo", "firecrawl", "openai"]),
    url: z.url(),
    confidence: z.number().min(0).max(1),
  }),
});

export type CompanySeedGraph = z.infer<typeof companySeedGraphSchema>;
