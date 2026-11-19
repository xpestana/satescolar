import { describe, expect, it } from "vitest";
import { allowedUserIds, loadScopeRows } from "./userEmailScope";

describe("allowedUserIds", () => {
  const requested = ["staff", "teacher", "family-user", "other-school-family", "stranger"];

  it("allows only accounts linked to the caller's school", () => {
    const allowed = allowedUserIds(requested, {
      roleUserIds: ["staff"],
      teacherUserIds: ["teacher"],
      families: [
        { id: "f1", user_id: "family-user" },
        { id: "f2", user_id: "other-school-family" },
      ],
      schoolFamilyIds: ["f1"],
    });
    expect([...allowed].sort()).toEqual(["family-user", "staff", "teacher"]);
  });

  it("never returns ids that were not requested", () => {
    const allowed = allowedUserIds(["a"], {
      roleUserIds: ["a", "b"],
      teacherUserIds: ["c"],
      families: [{ id: "f", user_id: "d" }],
      schoolFamilyIds: ["f"],
    });
    expect([...allowed]).toEqual(["a"]);
  });
});

describe("loadScopeRows", () => {
  it("skips the queries when there is nothing to check", async () => {
    const client = { from: () => { throw new Error("should not query"); } };
    await expect(loadScopeRows(client, [], ["s1"])).resolves.toEqual({
      roleUserIds: [],
      teacherUserIds: [],
      families: [],
      schoolFamilyIds: [],
    });
    await expect(loadScopeRows(client, ["u1"], [])).resolves.toMatchObject({ roleUserIds: [] });
  });

  it("maps the query results", async () => {
    const data: Record<string, unknown[]> = {
      user_roles: [{ user_id: "u1" }],
      teachers: [{ user_id: "u2" }, { user_id: null }],
      families: [{ id: "f1", user_id: "u3" }],
      family_schools: [{ family_id: "f1" }],
    };
    const client = {
      from: (table: string) => {
        const q = { select: () => q, in: () => q, then: (r: (v: unknown) => unknown) => r({ data: data[table] }) };
        return q;
      },
    };
    await expect(loadScopeRows(client, ["u1", "u2", "u3"], ["s1"])).resolves.toEqual({
      roleUserIds: ["u1"],
      teacherUserIds: ["u2"],
      families: [{ id: "f1", user_id: "u3" }],
      schoolFamilyIds: ["f1"],
    });
  });
});
