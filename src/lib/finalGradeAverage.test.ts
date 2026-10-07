import { describe, expect, it } from "vitest";
import { completeMomentsAverage, isFinalGradeStale, proposeFinalGrade } from "./finalGradeAverage";

describe("proposeFinalGrade", () => {
  it("promedia los tres momentos con dos decimales", () => {
    expect(proposeFinalGrade(["20", "20", "20"])).toBe("20.00");
    expect(proposeFinalGrade([18, 17, 18])).toBe("17.67");
  });

  it("cuenta como 0 el momento sin nota, igual que bachillerato", () => {
    expect(proposeFinalGrade(["18", "", "15"])).toBe("11.00");
    expect(proposeFinalGrade(["18", null, undefined])).toBe("6.00");
  });

  it("no propone nada si ningún momento tiene nota", () => {
    expect(proposeFinalGrade(["", null, undefined])).toBe("");
    expect(proposeFinalGrade(["abc", " ", ""])).toBe("");
  });
});

describe("completeMomentsAverage", () => {
  it("promedia solo con los tres momentos completos", () => {
    expect(completeMomentsAverage(["18", "16", "17"])).toBe("17.00");
    expect(completeMomentsAverage(["18", "", "17"])).toBeNull();
    expect(completeMomentsAverage(["18", "16"])).toBeNull();
  });
});

describe("isFinalGradeStale", () => {
  it("detecta cuando la definitiva no coincide con el promedio", () => {
    expect(isFinalGradeStale("18", "17.67")).toBe(true);
    expect(isFinalGradeStale("17.67", "17.67")).toBe(false);
    expect(isFinalGradeStale("20", "20.00")).toBe(false);
  });

  it("no avisa sin definitiva o sin promedio completo", () => {
    expect(isFinalGradeStale("", "17.00")).toBe(false);
    expect(isFinalGradeStale("18", null)).toBe(false);
  });
});
