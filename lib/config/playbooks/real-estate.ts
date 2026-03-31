import type { IndustryPlaybook } from "@/lib/config/playbooks/types";

export const realEstatePlaybook = {
  industryKey: "real_estate",
  aliases: [
    "real estate",
    "property",
    "realtor",
    "estate agent",
    "real estate agent",
    "property management",
  ],
  commonPains: [
    "lead leakage",
    "slow follow-up",
    "portal dependency",
    "weak listing presentation",
  ],
  offerAngles: [
    "lead response time optimization",
    "listing conversion",
    "CRM automation",
  ],
  preferredLeadMagnetTypes: [
    "cost-per-lead analysis",
    "automation opportunity snapshot",
    "website conversion teardown",
  ],
  messagingFocus:
    "Help real estate agents capture and convert more leads from their existing pipeline",
  ctaPreferences: [
    "Free lead response audit",
    "Quick listing conversion review",
  ],
  toneGuidance: "Energetic, results-oriented. Speak to ROI and speed.",
  doNotMention: ["property crash", "bubble"],
} satisfies IndustryPlaybook;
