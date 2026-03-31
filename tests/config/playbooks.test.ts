import { describe, expect, it } from "vitest";

import {
  accountingPlaybook,
  dentalClinicPlaybook,
  generalPlaybook,
  homeServicesPlaybook,
  lawFirmPlaybook,
  realEstatePlaybook,
  resolvePlaybook,
} from "@/lib/config/playbooks";

const allPlaybooks = [
  dentalClinicPlaybook,
  lawFirmPlaybook,
  accountingPlaybook,
  realEstatePlaybook,
  homeServicesPlaybook,
  generalPlaybook,
];

describe("resolvePlaybook", () => {
  it('resolves "Dental Clinic" to the dental playbook', () => {
    expect(resolvePlaybook("Dental Clinic")).toBe(dentalClinicPlaybook);
  });

  it('resolves "dentist" to the dental playbook via alias substring', () => {
    expect(resolvePlaybook("dentist")).toBe(dentalClinicPlaybook);
  });

  it('resolves "Law Practice" to the law firm playbook', () => {
    expect(resolvePlaybook("Law Practice")).toBe(lawFirmPlaybook);
  });

  it('resolves "attorney" to the law firm playbook via alias', () => {
    expect(resolvePlaybook("attorney")).toBe(lawFirmPlaybook);
  });

  it('resolves "plumbing" to the home services playbook via alias substring', () => {
    expect(resolvePlaybook("plumbing")).toBe(homeServicesPlaybook);
  });

  it('returns the general fallback for an unknown industry', () => {
    expect(resolvePlaybook("some unknown industry")).toBe(generalPlaybook);
  });

  it("returns the general fallback when industry is null", () => {
    expect(resolvePlaybook(null)).toBe(generalPlaybook);
  });
});

describe("playbook data integrity", () => {
  it("every playbook has at least 3 commonPains", () => {
    for (const playbook of allPlaybooks) {
      expect(
        playbook.commonPains.length,
        `${playbook.industryKey} should have at least 3 commonPains`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("every playbook has at least 2 preferredLeadMagnetTypes", () => {
    for (const playbook of allPlaybooks) {
      expect(
        playbook.preferredLeadMagnetTypes.length,
        `${playbook.industryKey} should have at least 2 preferredLeadMagnetTypes`,
      ).toBeGreaterThanOrEqual(2);
    }
  });
});
