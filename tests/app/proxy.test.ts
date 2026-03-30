import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

describe("proxy", () => {
  it("allows the google oauth callback route without an operator session", () => {
    const response = proxy(
      new NextRequest(
        "https://leadgen-indol.vercel.app/api/google-workspace/callback?code=test-code&state=test-state",
      ),
    );

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
