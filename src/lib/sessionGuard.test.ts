import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: h.getSession, getUser: h.getUser, signOut: h.signOut } },
}));

import { isRevokedSessionError, verifyServerSession } from "./sessionGuard";

const authApiError = (status: number, code?: string) => ({ name: "AuthApiError", status, code });

describe("isRevokedSessionError", () => {
  it("recognizes a deleted session", () => {
    expect(isRevokedSessionError(authApiError(403, "session_not_found"))).toBe(true);
  });

  it("recognizes a 401/403 from Auth without a code (older GoTrue)", () => {
    expect(isRevokedSessionError(authApiError(401))).toBe(true);
    expect(isRevokedSessionError(authApiError(403))).toBe(true);
  });

  it("does not treat network or server failures as a revoked session", () => {
    expect(isRevokedSessionError({ name: "AuthRetryableFetchError", status: 0 })).toBe(false);
    expect(isRevokedSessionError(authApiError(500))).toBe(false);
    expect(isRevokedSessionError(new Error("Failed to fetch"))).toBe(false);
    expect(isRevokedSessionError(null)).toBe(false);
  });
});

describe("verifyServerSession", () => {
  beforeEach(() => {
    h.getSession.mockReset().mockResolvedValue({ data: { session: { access_token: "t" } } });
    h.getUser.mockReset();
    h.signOut.mockReset().mockResolvedValue({ error: null });
  });

  it("keeps a session that Auth still knows", async () => {
    h.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    await expect(verifyServerSession()).resolves.toBe("valid");
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it("clears only this browser's session when the server already deleted it", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: authApiError(403, "session_not_found") });
    await expect(verifyServerSession()).resolves.toBe("revoked");
    expect(h.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the session on a connection failure", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } });
    await expect(verifyServerSession()).resolves.toBe("unknown");
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it("does nothing when there is no local session", async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    await expect(verifyServerSession()).resolves.toBe("unknown");
    expect(h.getUser).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    h.getUser.mockRejectedValue(new Error("boom"));
    await expect(verifyServerSession()).resolves.toBe("unknown");
  });
});
