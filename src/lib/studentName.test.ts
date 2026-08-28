import { describe, it, expect } from "vitest";
import { studentFullName, studentListName } from "./studentName";

describe("studentFullName", () => {
  it("joins names and surnames in reading order", () => {
    expect(
      studentFullName({
        primer_nombre: "Ana", segundo_nombre: "María",
        primer_apellido: "Pérez", segundo_apellido: "Gómez",
      }),
    ).toBe("Ana María Pérez Gómez");
  });

  it("accepts the legacy nombre/apellido keys", () => {
    expect(studentFullName({ nombre: "Luis", apellido: "Rojas" })).toBe("Luis Rojas");
  });

  it("skips the missing halves", () => {
    expect(studentFullName({ primer_nombre: "Ana" })).toBe("Ana");
    expect(studentFullName({ primer_apellido: "Pérez" })).toBe("Pérez");
  });

  it("falls back when there is nothing to show", () => {
    expect(studentFullName({})).toBe("Sin nombre");
    expect(studentFullName(null)).toBe("Sin nombre");
    expect(studentFullName(undefined)).toBe("Sin nombre");
  });
});

describe("studentListName", () => {
  it("puts the surnames first", () => {
    expect(
      studentListName({ primer_nombre: "Ana", primer_apellido: "Pérez", segundo_apellido: "Gómez" }),
    ).toBe("Pérez Gómez Ana");
  });

  it("falls back when there is nothing to show", () => {
    expect(studentListName({})).toBe("Sin nombre");
  });
});
