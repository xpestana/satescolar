import { describe, expect, it } from "vitest";
import { bearerToken, isServiceRoleToken } from "./serviceRole";

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
