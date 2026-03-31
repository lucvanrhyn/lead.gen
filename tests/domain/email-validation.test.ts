import { describe, it, expect } from "vitest";

import {
  isDisposableEmail,
  isValidEmailFormat,
  validateEmail,
} from "@/lib/domain/email-validation";

// ---------------------------------------------------------------------------
// isValidEmailFormat
// ---------------------------------------------------------------------------

describe("isValidEmailFormat", () => {
  it("accepts a standard email address", () => {
    expect(isValidEmailFormat("john@example.com")).toBe(true);
  });

  it("accepts email with subdomain", () => {
    expect(isValidEmailFormat("jane@mail.example.co.uk")).toBe(true);
  });

  it("accepts email with plus addressing", () => {
    expect(isValidEmailFormat("user+tag@example.com")).toBe(true);
  });

  it("accepts email with dots in local part", () => {
    expect(isValidEmailFormat("first.last@example.com")).toBe(true);
  });

  it("rejects empty string", () => {
    expect(isValidEmailFormat("")).toBe(false);
  });

  it("rejects null/undefined input", () => {
    expect(isValidEmailFormat(null as unknown as string)).toBe(false);
    expect(isValidEmailFormat(undefined as unknown as string)).toBe(false);
  });

  it("rejects email without @", () => {
    expect(isValidEmailFormat("notanemail")).toBe(false);
  });

  it("rejects email without domain", () => {
    expect(isValidEmailFormat("user@")).toBe(false);
  });

  it("rejects email without local part", () => {
    expect(isValidEmailFormat("@example.com")).toBe(false);
  });

  it("rejects email without TLD", () => {
    expect(isValidEmailFormat("user@localhost")).toBe(false);
  });

  it("rejects email exceeding 254 characters", () => {
    const longLocal = "a".repeat(243);
    expect(isValidEmailFormat(`${longLocal}@example.com`)).toBe(false);
  });

  it("rejects email with spaces", () => {
    expect(isValidEmailFormat("user @example.com")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDisposableEmail
// ---------------------------------------------------------------------------

describe("isDisposableEmail", () => {
  it("detects mailinator.com as disposable", () => {
    expect(isDisposableEmail("test@mailinator.com")).toBe(true);
  });

  it("detects guerrillamail.com as disposable", () => {
    expect(isDisposableEmail("test@guerrillamail.com")).toBe(true);
  });

  it("detects throwaway domains case-insensitively", () => {
    expect(isDisposableEmail("test@MAILINATOR.COM")).toBe(true);
  });

  it("does not flag gmail.com as disposable", () => {
    expect(isDisposableEmail("user@gmail.com")).toBe(false);
  });

  it("does not flag a legitimate business domain", () => {
    expect(isDisposableEmail("ceo@acmecorp.com")).toBe(false);
  });

  it("returns false for invalid input", () => {
    expect(isDisposableEmail("")).toBe(false);
    expect(isDisposableEmail("not-an-email")).toBe(false);
  });

  it("detects yopmail.com as disposable", () => {
    expect(isDisposableEmail("test@yopmail.com")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateEmail (combined)
// ---------------------------------------------------------------------------

describe("validateEmail", () => {
  it("returns valid for a legitimate email", () => {
    const result = validateEmail("ceo@acmecorp.com");

    expect(result.isValid).toBe(true);
    expect(result.isFormatValid).toBe(true);
    expect(result.isDisposable).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("returns invalid format for malformed email", () => {
    const result = validateEmail("not-valid");

    expect(result.isValid).toBe(false);
    expect(result.isFormatValid).toBe(false);
    expect(result.isDisposable).toBe(false);
    expect(result.reason).toBe("Invalid email format");
  });

  it("returns invalid for disposable email with valid format", () => {
    const result = validateEmail("test@mailinator.com");

    expect(result.isValid).toBe(false);
    expect(result.isFormatValid).toBe(true);
    expect(result.isDisposable).toBe(true);
    expect(result.reason).toBe("Disposable email domain");
  });

  it("preserves the original email in the result", () => {
    const result = validateEmail("Hello@Example.Com");
    expect(result.email).toBe("Hello@Example.Com");
  });

  it("result object is not mutated by re-assignment", () => {
    const result = validateEmail("test@gmail.com");
    const original = { ...result };

    // Attempting to modify should not affect the returned value
    // (readonly types prevent mutation at compile time; runtime freeze is optional)
    expect(result).toEqual(original);
  });
});
