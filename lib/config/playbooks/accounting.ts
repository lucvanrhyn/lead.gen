import type { IndustryPlaybook } from "@/lib/config/playbooks/types";

export const accountingPlaybook = {
  industryKey: "accounting",
  aliases: [
    "account",
    "bookkeep",
    "tax",
    "cpa",
    "chartered accountant",
    "auditing",
    "financial services",
  ],
  commonPains: [
    "compliance-only relationships",
    "client churn at year-end",
    "advisory revenue gap",
    "manual workflows",
  ],
  offerAngles: ["advisory upsell", "automation", "client retention"],
  preferredLeadMagnetTypes: [
    "automation opportunity snapshot",
    "pricing strategy teardown",
    "compliance gap review",
  ],
  messagingFocus:
    "Help accounting firms transition from compliance work to advisory revenue",
  ctaPreferences: [
    "Quick workflow efficiency review",
    "Advisory revenue opportunity assessment",
  ],
  toneGuidance: "Data-driven, methodical. Use financial language naturally.",
  doNotMention: ["creative accounting", "loopholes"],
} satisfies IndustryPlaybook;
