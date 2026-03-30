import { describe, expect, it } from "vitest";

import {
  createOperatorSessionToken,
  hasValidOperatorCredentials,
  readOperatorSessionToken,
} from "@/lib/auth/session";

describe("operator session helpers", () => {
  const env = {
    OPERATOR_EMAIL: "owner@example.com",
    OPERATOR_PASSWORD: "super-secret-password",
    OPERATOR_SESSION_SECRET: "session-secret-value",
  } as unknown as NodeJS.ProcessEnv;

  it("creates and validates a signed operator session token", () => {
    const token = createOperatorSessionToken("owner@example.com", env);

    expect(readOperatorSessionToken(token, env)).toMatchObject({
      email: "owner@example.com",
    });
  });

  it("rejects a tampered operator session token", () => {
    const token = createOperatorSessionToken("owner@example.com", env);
    const tampered = `${token}tampered`;

    expect(readOperatorSessionToken(tampered, env)).toBeNull();
  });

  it("accepts only the configured operator credentials", () => {
    expect(
      hasValidOperatorCredentials("owner@example.com", "super-secret-password", env),
    ).toBe(true);
    expect(hasValidOperatorCredentials("owner@example.com", "wrong-password", env)).toBe(
      false,
    );
    expect(hasValidOperatorCredentials("intruder@example.com", "super-secret-password", env)).toBe(
      false,
    );
  });
});
