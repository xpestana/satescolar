import { describe, expect, it, vi } from "vitest";
import { bearerToken, isServiceRoleToken, verifyServiceRoleToken } from "./serviceRole";

const b64url = (obj: unknown) =>
  btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const jwt = (payload: unknown) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;

describe("isServiceRoleToken", () => {
  it("accepts a service-role token", () => {
    expect(isServiceRoleToken(jwt({ role: "service_role", iss: "supabase" }))).toBe(true);
  });

  it("rejects the anon key and user tokens (anyone could trigger the reminders before)", () => {
    expect(isServiceRoleToken(jwt({ role: "anon" }))).toBe(false);
    expect(isServiceRoleToken(jwt({ role: "authenticated", sub: "u1" }))).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(isServiceRoleToken("")).toBe(false);
    expect(isServiceRoleToken("abc")).toBe(false);
    expect(isServiceRoleToken("a.%%%.c")).toBe(false);
  });

  it("handles payloads whose base64 needs padding", () => {
    expect(isServiceRoleToken(jwt({ role: "service_role", x: "a" }))).toBe(true);
    expect(isServiceRoleToken(jwt({ role: "service_role", x: "ab" }))).toBe(true);
    expect(isServiceRoleToken(jwt({ role: "service_role", x: "abc" }))).toBe(true);
  });
});

describe("bearerToken", () => {
  it("extracts the token from the Authorization header", () => {
    const req = new Request("https://x.test", { headers: { Authorization: "Bearer abc.def.ghi" } });
    expect(bearerToken(req)).toBe("abc.def.ghi");
  });

  it("returns an empty string without header", () => {
    expect(bearerToken(new Request("https://x.test"))).toBe("");
  });
});

describe("verifyServiceRoleToken", () => {
  const supabaseUrl = "https://project.supabase.co";
  const serviceRoleKey = jwt({ role: "service_role", ref: "project" });

  it("accepts the function's own service-role key without a network call", async () => {
    const fetchFn = vi.fn();
    await expect(verifyServiceRoleToken(serviceRoleKey, { supabaseUrl, serviceRoleKey, fetchFn })).resolves.toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects a forged token that only claims service_role (Auth refuses its signature)", async () => {
    const forged = jwt({ role: "service_role", forged: true });
    const fetchFn = vi.fn(async () => new Response("{}", { status: 401 }));
    await expect(verifyServiceRoleToken(forged, { supabaseUrl, serviceRoleKey, fetchFn })).resolves.toBe(false);
    expect(fetchFn).toHaveBeenCalledWith(
      `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=1`,
      { headers: { apikey: forged, Authorization: `Bearer ${forged}` } },
    );
  });

  it("accepts another valid service-role key (e.g. the Vault copy used by the cron)", async () => {
    const vaultKey = jwt({ role: "service_role", iat: 1 });
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    await expect(verifyServiceRoleToken(vaultKey, { supabaseUrl, serviceRoleKey, fetchFn })).resolves.toBe(true);
  });

  it("rejects user tokens and anon keys without calling Auth", async () => {
    const fetchFn = vi.fn();
    await expect(verifyServiceRoleToken(jwt({ role: "authenticated" }), { supabaseUrl, serviceRoleKey, fetchFn }))
      .resolves.toBe(false);
    await expect(verifyServiceRoleToken(jwt({ role: "anon" }), { supabaseUrl, serviceRoleKey, fetchFn }))
      .resolves.toBe(false);
    await expect(verifyServiceRoleToken("", { supabaseUrl, serviceRoleKey, fetchFn })).resolves.toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects when Auth cannot be reached", async () => {
    const fetchFn = vi.fn(async () => { throw new Error("network down"); });
    await expect(verifyServiceRoleToken(jwt({ role: "service_role", x: 1 }), { supabaseUrl, serviceRoleKey, fetchFn }))
      .resolves.toBe(false);
  });
});
