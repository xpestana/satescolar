import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPreferredSchoolYearId,
  rememberSchoolYearChoice,
  resolveSchoolYearId,
} from "./schoolYearPreference";

const years = [
  { id: "y2627", is_active: true },
  { id: "y2526", is_active: false },
  { id: "y2425", is_active: false },
];

/** In-memory Storage, so the tests don't depend on the runtime's (Node/jsdom) localStorage. */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

let storage: Storage;

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal("localStorage", storage);
  return () => vi.unstubAllGlobals();
});

describe("resolveSchoolYearId", () => {
  it("returns null for an empty list", () => {
    expect(resolveSchoolYearId([], "y2526")).toBeNull();
  });

  it("uses the remembered year when it still exists", () => {
    expect(resolveSchoolYearId(years, "y2526")).toBe("y2526");
  });

  it("falls back to the active year when nothing is remembered", () => {
    expect(resolveSchoolYearId(years, null)).toBe("y2627");
  });

  it("falls back to the active year when the remembered one was deleted", () => {
    expect(resolveSchoolYearId(years, "deleted")).toBe("y2627");
  });

  it("falls back to the first year when none is active", () => {
    const noneActive = years.map((y) => ({ ...y, is_active: false }));
    expect(resolveSchoolYearId(noneActive, null)).toBe("y2627");
  });
});

describe("rememberSchoolYearChoice / readPreferredSchoolYearId", () => {
  it("remembers a non-active year per school", () => {
    rememberSchoolYearChoice("school-a", "y2526", years);
    expect(readPreferredSchoolYearId("school-a")).toBe("y2526");
    expect(readPreferredSchoolYearId("school-b")).toBeNull();
  });

  it("choosing the active year clears the preference", () => {
    rememberSchoolYearChoice("school-a", "y2526", years);
    rememberSchoolYearChoice("school-a", "y2627", years);
    expect(readPreferredSchoolYearId("school-a")).toBeNull();
  });

  it("an unknown year id clears the preference", () => {
    rememberSchoolYearChoice("school-a", "y2526", years);
    rememberSchoolYearChoice("school-a", "unknown", years);
    expect(readPreferredSchoolYearId("school-a")).toBeNull();
  });

  it("ignores an empty school id", () => {
    rememberSchoolYearChoice("", "y2526", years);
    expect(readPreferredSchoolYearId("")).toBeNull();
    expect(storage.length).toBe(0);
  });

  it("does not throw when storage is unavailable", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { ...storage, getItem: blocked, setItem: blocked, removeItem: blocked });
    expect(() => rememberSchoolYearChoice("school-a", "y2526", years)).not.toThrow();
    expect(readPreferredSchoolYearId("school-a")).toBeNull();
  });
});
