import { buildDiagnosticFormBlueprint } from "@/lib/ai/diagnostic-form";

describe("buildDiagnosticFormBlueprint", () => {
  it("includes common sections and additive law-firm questions", () => {
    const blueprint = buildDiagnosticFormBlueprint({
      companyName: "Burger Huyser Attorneys",
      industry: "Law Firms",
      primaryPain: "slow intake and follow-up",
      serviceAngle: "improve intake handoff and response speed",
    });

    expect(blueprint.form_sections).toHaveLength(5);
    expect(blueprint.estimated_completion_time).toBe("2-4 minutes");
    expect(JSON.stringify(blueprint.form_sections).toLowerCase()).toContain("matter");
  });
});
