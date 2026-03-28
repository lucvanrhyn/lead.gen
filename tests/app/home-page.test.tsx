import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

describe("HomePage", () => {
  it("shows the lead intelligence dashboard heading", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", { name: /lead intelligence engine/i }),
    ).toBeInTheDocument();
  });
});
