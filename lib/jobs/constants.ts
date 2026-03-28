export const enrichmentJobNames = {
  discovery: "lead.discovery",
  apolloCompanyEnrichment: "lead.enrich.apollo-company",
  apolloPeopleEnrichment: "lead.enrich.apollo-people",
  firecrawlExtraction: "lead.extract.firecrawl",
  painHypothesisGeneration: "lead.generate.pain-hypothesis",
  leadScoring: "lead.generate.lead-score",
  leadMagnetGeneration: "lead.generate.lead-magnet",
  outreachGeneration: "lead.generate.outreach",
} as const;

export type EnrichmentJobName =
  (typeof enrichmentJobNames)[keyof typeof enrichmentJobNames];
