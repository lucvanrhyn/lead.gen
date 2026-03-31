import type { IndustryPlaybook } from "@/lib/config/playbooks/types";

export const generalPlaybook = {
  industryKey: "general",
  aliases: [],
  commonPains: [
    "unclear value proposition",
    "weak lead capture",
    "manual workflows",
    "inconsistent follow-up",
  ],
  offerAngles: [
    "lead capture optimization",
    "workflow automation",
    "positioning clarity",
  ],
  preferredLeadMagnetTypes: [
    "website conversion teardown",
    "automation opportunity snapshot",
    "local SEO audit",
  ],
  messagingFocus:
    "Help service businesses capture more value from their existing visibility and operations",
  ctaPreferences: [
    "Quick website review",
    "Free operational efficiency check",
  ],
  toneGuidance:
    "Professional, helpful. Adapt to the prospect's apparent industry language.",
  doNotMention: [],
} satisfies IndustryPlaybook;
