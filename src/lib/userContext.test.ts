import { describe, expect, it } from "vitest";
import {
  USER_CONTEXT_STORAGE_KEY,
  clearCachedContext,
  parseUserContext,
  readCachedContext,
  writeCachedContext,
} from "./userContext";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const teacherRaw = {
  role: "teacher",
  role_school_id: "sc1",
  school_id: "sc1",
  is_owner: false,
  teacher_id: "t1",
  family_id: null,
  modules: [{ module_key: "attendance", enabled: true, expires_at: null }],
  permissions: [],
};

describe("parseUserContext", () => {
  it("maps the function answer", () => {
    expect(parseUserContext(teacherRaw)).toEqual({
      role: "teacher",
      roleSchoolId: "sc1",
      schoolId: "sc1",
      isOwner: false,
      teacherId: "t1",
      familyId: null,
      modules: [{ module_key: "attendance", enabled: true, expires_at: null }],
      permissions: [],
    });
  });

  it("treats a missing answer or unknown role as no role", () => {
    expect(parseUserContext(null).role).toBeNull();
    expect(parseUserContext({ role: "superuser" }).role).toBeNull();
    expect(parseUserContext(undefined).modules).toEqual([]);
  });

  it("keeps sub-user permission items and drops malformed rows", () => {
    const ctx = parseUserContext({
      role: "school",
      permissions: [{ key: "teachers.view", scope: { grade_levels: ["1_grado"] } }, { nokey: 1 }, null],
      modules: [{ enabled: true }, { module_key: "grades", enabled: false, expires_at: "2027-01-01" }],
    });
    expect(ctx.permissions).toEqual([{ key: "teachers.view", scope: { grade_levels: ["1_grado"] } }]);
    expect(ctx.modules).toEqual([{ module_key: "grades", enabled: false, expires_at: "2027-01-01" }]);
  });
});

describe("context cache", () => {
  it("returns the cached context only for the same user", () => {
    const storage = memoryStorage();
    writeCachedContext("u1", parseUserContext(teacherRaw), storage);
    expect(readCachedContext("u1", storage)?.teacherId).toBe("t1");
    expect(readCachedContext("u2", storage)).toBeNull();
  });

  it("keeps a single entry, so switching users (impersonation) replaces it", () => {
    const storage = memoryStorage();
    writeCachedContext("u1", parseUserContext(teacherRaw), storage);
    writeCachedContext("u2", parseUserContext({ role: "school", school_id: "sc2" }), storage);
    expect(storage.map.size).toBe(1);
    expect(readCachedContext("u1", storage)).toBeNull();
    expect(readCachedContext("u2", storage)?.role).toBe("school");
  });

  it("clears the entry and survives corrupt or blocked storage", () => {
    const storage = memoryStorage();
    writeCachedContext("u1", parseUserContext(teacherRaw), storage);
    clearCachedContext(storage);
    expect(readCachedContext("u1", storage)).toBeNull();

    storage.setItem(USER_CONTEXT_STORAGE_KEY, "{not json");
    expect(readCachedContext("u1", storage)).toBeNull();

    const throwing = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(readCachedContext("u1", throwing)).toBeNull();
    expect(() => writeCachedContext("u1", parseUserContext(teacherRaw), throwing)).not.toThrow();
    expect(() => clearCachedContext(throwing)).not.toThrow();
    expect(readCachedContext("u1", null)).toBeNull();
  });
});
