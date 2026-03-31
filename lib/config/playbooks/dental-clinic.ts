import type { IndustryPlaybook } from "@/lib/config/playbooks/types";

export const dentalClinicPlaybook = {
  industryKey: "dental_clinic",
  aliases: ["dental", "dentist", "orthodont", "oral health", "dental clinic", "dental practice"],
  commonPains: [
    "booking friction",
    "patient no-shows",
    "low case acceptance",
    "weak online presence",
    "manual patient comms",
  ],
  offerAngles: [
    "booking flow optimization",
    "patient retention",
    "treatment acceptance coaching",
  ],
  preferredLeadMagnetTypes: [
    "booking-flow audit",
    "website conversion teardown",
    "local SEO audit",
  ],
  messagingFocus:
    "Help dental practices fill chairs with higher-value treatments by fixing the patient journey from search to booking",
  ctaPreferences: [
    "Free booking flow review",
    "Quick audit of your patient conversion path",
  ],
  toneGuidance:
    "Professional but warm. Reference clinical excellence without being patronising.",
  doNotMention: ["cheap", "discount", "drill", "pain"],
} satisfies IndustryPlaybook;
