import { describe, expect, it } from "vitest";
import { teacherDisplayName } from "./teacherName";

describe("teacherDisplayName", () => {
  it("reads either naming of the teacher form", () => {
    expect(teacherDisplayName({ nombre: "Ana", apellido: "Pérez" })).toBe("Ana Pérez");
    expect(teacherDisplayName({ primer_nombre: "Luis", primer_apellido: "Báez" })).toBe("Luis Báez");
    expect(teacherDisplayName(null)).toBe("");
  });
});
