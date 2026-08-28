import { describe, expect, it } from "vitest";
import { getAccountEntryPath } from "../client/src/const";
import { hashPassword, verifyPassword } from "./localAuth";

describe("first-party account credentials", () => {
  it("uses a salted, verifiable password hash instead of retaining the plaintext password", async () => {
    const hash = await hashPassword("a-secure-password");
    expect(hash).toMatch(/^scrypt-v1\$/);
    expect(hash).not.toContain("a-secure-password");
    await expect(verifyPassword("a-secure-password", hash)).resolves.toBe(true);
    await expect(verifyPassword("incorrect-password", hash)).resolves.toBe(false);
  });

  it("constructs stable first-party paths for sign-in and account creation", () => {
    expect(getAccountEntryPath("signIn")).toBe("/login?mode=signin");
    expect(getAccountEntryPath("signUp")).toBe("/login?mode=signup");
  });
});
