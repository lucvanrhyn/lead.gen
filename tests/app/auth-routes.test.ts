describe("auth routes", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      OPERATOR_EMAIL: "owner@example.com",
      OPERATOR_PASSWORD: "super-secret-password",
      OPERATOR_SESSION_SECRET: "session-secret-value",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("sets a session cookie and redirects to leads after successful login", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: "owner@example.com",
        password: "super-secret-password",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/leads");
    expect(response.cookies.get("leadgen_operator_session")?.value).toBeTruthy();
  });

  it("redirects back to login with an error when credentials are invalid", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const request = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: "owner@example.com",
        password: "wrong-password",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=invalid");
    expect(response.cookies.get("leadgen_operator_session")).toBeUndefined();
  });

  it("clears the session cookie on logout", async () => {
    const { POST } = await import("@/app/api/auth/logout/route");
    const request = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });

    const response = await POST(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(response.cookies.get("leadgen_operator_session")?.value).toBe("");
  });
});
