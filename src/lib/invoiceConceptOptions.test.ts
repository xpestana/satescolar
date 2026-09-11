import { describe, expect, it } from "vitest";
import { uniqueConceptLineages } from "./invoiceConceptOptions";

describe("uniqueConceptLineages", () => {
  it("returns an empty list for no rows", () => {
    expect(uniqueConceptLineages([])).toEqual([]);
  });

  it("keeps one option per lineage, using the lineage id as field id", () => {
    const rows = [
      { lineage_id: "L1", name: "Mes de Agosto" }, // copia 2026-2027
      { lineage_id: "L1", name: "Mes de Agosto" }, // original 2025-2026
      { lineage_id: "L2", name: "Matricula INS" },
    ];
    expect(uniqueConceptLineages(rows)).toEqual([
      { id: "L2", name: "Matricula INS" },
      { id: "L1", name: "Mes de Agosto" },
    ]);
  });

  it("uses the first (newest) name of a renamed lineage", () => {
    const rows = [
      { lineage_id: "L1", name: "Mensualidad Agosto" },
      { lineage_id: "L1", name: "Mes de Agosto" },
    ];
    expect(uniqueConceptLineages(rows)).toEqual([{ id: "L1", name: "Mensualidad Agosto" }]);
  });

  it("ignores rows without lineage", () => {
    expect(uniqueConceptLineages([{ lineage_id: "", name: "Suelto" }])).toEqual([]);
  });
});
