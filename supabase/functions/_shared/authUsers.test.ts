import { describe, expect, it, vi } from "vitest";
import { findUserByEmail, type AuthAdminLister, type AuthUserSummary } from "./authUsers";

function fakeAdmin(allUsers: AuthUserSummary[]) {
  const listUsers = vi.fn(async ({ page, perPage }: { page: number; perPage: number }) => ({
    data: { users: allUsers.slice((page - 1) * perPage, page * perPage) },
    error: null,
  }));
  const admin: AuthAdminLister = { auth: { admin: { listUsers } } };
  return { admin, listUsers };
}

const users = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, email: `user${i}@example.com` }));

describe("findUserByEmail", () => {
  it("finds a user beyond the first page (the old 50-user bug)", async () => {
    const { admin, listUsers } = fakeAdmin(users(120));
    await expect(findUserByEmail(admin, "user110@example.com", 50)).resolves.toEqual({
      id: "u110",
      email: "user110@example.com",
    });
    expect(listUsers).toHaveBeenCalledTimes(3);
  });

  it("ignores case and surrounding spaces", async () => {
    const { admin } = fakeAdmin(users(3));
    await expect(findUserByEmail(admin, "  USER2@Example.com ")).resolves.toMatchObject({ id: "u2" });
  });

  it("returns null when the email does not exist and stops at the last page", async () => {
    const { admin, listUsers } = fakeAdmin(users(100));
    await expect(findUserByEmail(admin, "nobody@example.com", 50)).resolves.toBeNull();
    // Page 3 comes back empty (< perPage), so it stops there.
    expect(listUsers).toHaveBeenCalledTimes(3);
  });

  it("returns null for an empty email without calling the API", async () => {
    const { admin, listUsers } = fakeAdmin(users(3));
    await expect(findUserByEmail(admin, "   ")).resolves.toBeNull();
    expect(listUsers).not.toHaveBeenCalled();
  });

  it("propagates API errors instead of treating the user as new", async () => {
    const admin: AuthAdminLister = {
      auth: { admin: { listUsers: async () => ({ data: null, error: new Error("boom") }) } },
    };
    await expect(findUserByEmail(admin, "a@example.com")).rejects.toThrow("boom");
  });
});
