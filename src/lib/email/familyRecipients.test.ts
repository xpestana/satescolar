import { describe, expect, it } from "vitest";
import { buildFamilyRecipients, type FamilyRow, type RepresentativeRow } from "./familyRecipients";

const family = (id: string, user_id: string | null, extra: Partial<FamilyRow> = {}): FamilyRow => ({
  id,
  user_id,
  ...extra,
});
const rep = (family_id: string, overrides: Partial<RepresentativeRow> = {}): RepresentativeRow => ({
  family_id,
  is_primary: true,
  email: null,
  form_data: { primer_nombre: "Ana", primer_apellido: "Pérez" },
  ...overrides,
});

describe("buildFamilyRecipients", () => {
  it("uses the family account email even when representatives.email is empty (the (0) bug)", () => {
    const result = buildFamilyRecipients([family("f1", "u1")], [rep("f1")], { u1: "familia@example.com" });
    expect(result).toEqual([{ familyId: "f1", email: "familia@example.com", name: "Ana Pérez" }]);
  });

  it("works for families without a primary representative", () => {
    const result = buildFamilyRecipients(
      [family("f1", "u1")],
      [rep("f1", { is_primary: false, form_data: { primer_nombre: "Luis", primer_apellido: "Rojas" } })],
      { u1: "rojas@example.com" },
    );
    expect(result).toEqual([{ familyId: "f1", email: "rojas@example.com", name: "Luis Rojas" }]);
  });

  it("falls back to the primary representative's email column, then its form email", () => {
    const result = buildFamilyRecipients(
      [family("f1", null), family("f2", "u2")],
      [rep("f1", { email: " Rep1@Example.com " }), rep("f2", { form_data: { correo_electronico: "rep2@example.com" } })],
      {},
    );
    expect(result.map((r) => r.email).sort()).toEqual(["rep1@example.com", "rep2@example.com"]);
  });

  it("names a family without representatives by its surname, or by its email", () => {
    const result = buildFamilyRecipients(
      [family("f1", "u1", { father_last_name: "Gómez" }), family("f2", "u2")],
      [],
      { u1: "gomez@example.com", u2: "otra@example.com" },
    );
    expect(result).toEqual([
      { familyId: "f1", email: "gomez@example.com", name: "Familia Gómez" },
      { familyId: "f2", email: "otra@example.com", name: "otra@example.com" },
    ]);
  });

  it("skips families without any valid email and de-duplicates shared emails", () => {
    const result = buildFamilyRecipients(
      [family("f1", "u1"), family("f2", "u2"), family("f3", null)],
      [rep("f3", { email: "sin-arroba" })],
      { u1: "misma@example.com", u2: "MISMA@example.com" },
    );
    expect(result.map((r) => r.familyId)).toEqual(["f1"]);
  });

  it("returns an empty list for a school without families", () => {
    expect(buildFamilyRecipients([], [], {})).toEqual([]);
  });
});
