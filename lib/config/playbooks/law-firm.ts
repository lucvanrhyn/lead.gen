import type { IndustryPlaybook } from "@/lib/config/playbooks/types";

export const lawFirmPlaybook = {
  industryKey: "law_firm",
  aliases: ["law", "legal", "attorney", "solicitor", "lawyer", "law firm", "law practice", "advocate"],
  commonPains: [
    "commoditized perception",
    "weak lead capture",
    "referral dependency",
    "poor practice-area positioning",
  ],
  offerAngles: [
    "positioning + differentiation",
    "lead capture optimization",
    "authority building",
  ],
  preferredLeadMagnetTypes: [
    "website conversion teardown",
    "referral system audit",
    "local SEO audit",
  ],
  messagingFocus:
    "Help law firms differentiate and capture more qualified enquiries from their existing visibility",
  ctaPreferences: [
    "Complimentary enquiry flow review",
    "Quick positioning audit",
  ],
  toneGuidance:
    "Formal, precise. Avoid salesy language. Frame everything as professional advisory.",
  doNotMention: ["ambulance chasing", "cheap", "guaranteed results"],
} satisfies IndustryPlaybook;
