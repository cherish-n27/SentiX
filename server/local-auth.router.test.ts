import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createLocalAccount: vi.fn(),
  getLocalAccountCredential: vi.fn(),
  upsertUser: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  createSessionToken: vi.fn(),
}));

vi.mock("./db", () => {
  class LocalAccountEmailTakenError extends Error {}
  return {
    addSentiXChatMessage: vi.fn(),
    clearSentiXChatHistory: vi.fn(),
    createLocalAccount: mocks.createLocalAccount,
    createSentiXWorkspace: vi.fn(),
    getLocalAccountCredential: mocks.getLocalAccountCredential,
    listSentiXQuickAnalyses: vi.fn(),
    listSentiXWorkspaces: vi.fn(),
    loadSentiXWorkspace: vi.fn(),
    LocalAccountEmailTakenError,
    renameSentiXWorkspace: vi.fn(),
    replaceSentiXWorkspaceReviews: vi.fn(),
    saveSentiXQuickAnalyses: vi.fn(),
    upsertUser: mocks.upsertUser,
  };
});
vi.mock("./localAuth", () => ({ hashPassword: mocks.hashPassword, verifyPassword: mocks.verifyPassword }));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: mocks.createSessionToken } }));

import { appRouter } from "./routers";

const sampleUser = {
  id: 17,
  openId: "local_sample_user",
  name: "Sam Taylor",
  email: "sam@example.com",
  loginMethod: "password",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function context() {
  const cookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  return {
    cookies,
    ctx: {
      user: null,
      req: { protocol: "https", headers: {} },
      res: {
        cookie: (name: string, value: string, options: Record<string, unknown>) => cookies.push({ name, value, options }),
        clearCookie: vi.fn(),
      },
    } as any,
  };
}

describe("auth local account router", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.hashPassword.mockResolvedValue("scrypt-v1$salt$hash");
    mocks.createSessionToken.mockResolvedValue("signed-session-token");
    mocks.createLocalAccount.mockResolvedValue(sampleUser);
    mocks.getLocalAccountCredential.mockResolvedValue({ user: sampleUser, passwordHash: "scrypt-v1$salt$hash" });
    mocks.verifyPassword.mockResolvedValue(true);
  });

  it("registers a local account with a hash and immediately issues the existing signed session cookie", async () => {
    const { ctx, cookies } = context();
    const result = await appRouter.createCaller(ctx).auth.register({ name: "Sam Taylor", email: "SAM@example.com", password: "a-secure-password" });

    expect(mocks.hashPassword).toHaveBeenCalledWith("a-secure-password");
    expect(mocks.createLocalAccount).toHaveBeenCalledWith({ name: "Sam Taylor", email: "sam@example.com", passwordHash: "scrypt-v1$salt$hash" });
    expect(mocks.createSessionToken).toHaveBeenCalledWith("local_sample_user", expect.objectContaining({ expiresInMs: expect.any(Number) }));
    expect(cookies[0]).toMatchObject({ name: "app_session_id", value: "signed-session-token", options: { httpOnly: true, path: "/", sameSite: "none", secure: true } });
    expect(result.user).toEqual({ id: 17, name: "Sam Taylor", email: "sam@example.com", loginMethod: "password" });
  });

  it("accepts a valid local password and restores the same signed session model", async () => {
    const { ctx, cookies } = context();
    const result = await appRouter.createCaller(ctx).auth.login({ email: "sam@example.com", password: "a-secure-password" });

    expect(mocks.verifyPassword).toHaveBeenCalledWith("a-secure-password", "scrypt-v1$salt$hash");
    expect(mocks.upsertUser).toHaveBeenCalledWith(expect.objectContaining({ openId: "local_sample_user" }));
    expect(cookies).toHaveLength(1);
    expect(result.user.email).toBe("sam@example.com");
  });

  it("rejects unknown credentials without issuing a session", async () => {
    mocks.getLocalAccountCredential.mockResolvedValue(undefined);
    const { ctx, cookies } = context();
    await expect(appRouter.createCaller(ctx).auth.login({ email: "unknown@example.com", password: "a-secure-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toHaveLength(0);
  });
});
