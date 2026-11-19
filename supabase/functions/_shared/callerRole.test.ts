import { describe, expect, it } from "vitest";
import { getCallerRole, pickCallerRole, type RoleRow, type UserRolesReader } from "./callerRole";

const school: RoleRow = { role: "school", school_id: "s1", is_owner: false };
const representative: RoleRow = { role: "representative", school_id: "s1" };
const teacher: RoleRow = { role: "teacher", school_id: "s1" };
const admin: RoleRow = { role: "admin", school_id: null };

describe("pickCallerRole", () => {
  it("accepts a school employee who is also a representative (old .single() failed)", () => {
    expect(pickCallerRole([representative, school], ["school"])).toBe(school);
  });

  it("rejects teachers and representatives for school-only actions", () => {
    expect(pickCallerRole([teacher, representative], ["school"])).toBeNull();
  });

  it("follows the order of the allowed roles", () => {
    expect(pickCallerRole([school, admin], ["admin", "school"])).toBe(admin);
    expect(pickCallerRole([school, admin], ["school", "admin"])).toBe(school);
  });

  it("skips rows without a school when one is required", () => {
    expect(pickCallerRole([admin], ["school", "admin"], { requireSchool: true })).toBeNull();
    expect(pickCallerRole([admin, school], ["admin", "school"], { requireSchool: true })).toBe(school);
  });

  it("handles empty input", () => {
    expect(pickCallerRole(null, ["school"])).toBeNull();
    expect(pickCallerRole([], ["school"])).toBeNull();
  });
});

describe("getCallerRole", () => {
  it("queries only the allowed roles of the user", async () => {
    const calls: unknown[] = [];
    const client: UserRolesReader = {
      from: (table) => ({
        select: (columns) => ({
          eq: (column, value) => ({
            in: (roleColumn, values) => {
              calls.push({ table, columns, column, value, roleColumn, values });
              return Promise.resolve({ data: [school], error: null });
            },
          }),
        }),
      }),
    };
    await expect(getCallerRole(client, "user-1", ["school"])).resolves.toBe(school);
    expect(calls).toEqual([
      {
        table: "user_roles",
        columns: "role, school_id, is_owner",
        column: "user_id",
        value: "user-1",
        roleColumn: "role",
        values: ["school"],
      },
    ]);
  });

  it("throws on query errors", async () => {
    const client: UserRolesReader = {
      from: () => ({
        select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: null, error: new Error("db down") }) }) }),
      }),
    };
    await expect(getCallerRole(client, "user-1", ["school"])).rejects.toThrow("db down");
  });
});
