import HomePage from "@/app/page";

const redirect = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

describe("HomePage", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("redirects to the working leads workflow", () => {
    HomePage();

    expect(redirect).toHaveBeenCalledWith("/leads");
  });
});
