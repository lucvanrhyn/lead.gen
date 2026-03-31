import type { IndustryPlaybook } from "@/lib/config/playbooks/types";

export const homeServicesPlaybook = {
  industryKey: "home_services",
  aliases: [
    "plumb",
    "electric",
    "hvac",
    "roofing",
    "landscap",
    "clean",
    "pest control",
    "contractor",
    "home service",
    "handyman",
    "painting",
  ],
  commonPains: [
    "seasonal demand swings",
    "poor online reviews",
    "no booking system",
    "referral-only growth",
  ],
  offerAngles: [
    "online booking implementation",
    "review generation",
    "local SEO",
  ],
  preferredLeadMagnetTypes: [
    "local SEO audit",
    "booking-flow audit",
    "referral system audit",
  ],
  messagingFocus:
    "Help home service businesses get steady bookings year-round instead of feast-or-famine cycles",
  ctaPreferences: [
    "Free local visibility check",
    "Quick booking system review",
  ],
  toneGuidance:
    "Straightforward, practical. Avoid jargon. Focus on tangible outcomes.",
  doNotMention: ["cheap labor", "unlicensed"],
} satisfies IndustryPlaybook;
