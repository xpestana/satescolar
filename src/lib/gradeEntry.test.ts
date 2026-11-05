import { describe, expect, it } from "vitest";
import {
  changedGrades,
  countFilledGrades,
  gradeKey,
  isAcceptedGradeInput,
  studentGradeValues,
} from "./gradeEntry";

describe("isAcceptedGradeInput", () => {
  it("accepts anything on descriptive sheets", () => {
    expect(isAcceptedGradeInput("Logró el objetivo", false)).toBe(true);
    expect(isAcceptedGradeInput("", false)).toBe(true);
  });

  it("accepts empty and 1–20 on numeric sheets", () => {
    expect(isAcceptedGradeInput("", true)).toBe(true);
    expect(isAcceptedGradeInput("1", true)).toBe(true);
    expect(isAcceptedGradeInput("20", true)).toBe(true);
    expect(isAcceptedGradeInput("15.5", true)).toBe(true);
  });

  it("rejects out-of-range or non numeric values on numeric sheets", () => {
    expect(isAcceptedGradeInput("0", true)).toBe(false);
    expect(isAcceptedGradeInput("21", true)).toBe(false);
    expect(isAcceptedGradeInput("-3", true)).toBe(false);
    expect(isAcceptedGradeInput("abc", true)).toBe(false);
  });
});

describe("studentGradeValues", () => {
  it("picks one student's grades and fills the missing ones with empty strings", () => {
    const grades = { [gradeKey("s1", "p1")]: "18", [gradeKey("s2", "p1")]: "12" };
    expect(studentGradeValues(grades, "s1", ["p1", "p2"])).toEqual({ p1: "18", p2: "" });
  });
});

describe("changedGrades", () => {
  it("returns only the plan items that changed, trimmed", () => {
    const saved = { p1: "18", p2: "", p3: "10" };
    const draft = { p1: "18", p2: " 15 ", p3: "" };
    expect(changedGrades(draft, saved, ["p1", "p2", "p3"])).toEqual([
      { planItemId: "p2", value: "15" },
      { planItemId: "p3", value: "" },
    ]);
  });

  it("ignores whitespace-only differences", () => {
    expect(changedGrades({ p1: "18 " }, { p1: "18" }, ["p1"])).toEqual([]);
  });

  it("is empty with no plan items", () => {
    expect(changedGrades({}, {}, [])).toEqual([]);
  });
});

describe("countFilledGrades", () => {
  it("counts non-blank values among the plan items", () => {
    expect(countFilledGrades({ p1: "18", p2: "  ", p3: "Bien" }, ["p1", "p2", "p3"])).toBe(2);
    expect(countFilledGrades({}, ["p1"])).toBe(0);
  });
});
