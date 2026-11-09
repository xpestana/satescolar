import { describe, expect, it } from "vitest";
import {
  amountInPaymentCurrency,
  defaultCategoriesLabel,
  defaultConceptLines,
  sharedCurrency,
} from "./defaultConcepts";
import type { PayrollConcept } from "./types";

const concept = (id: string, overrides: Partial<PayrollConcept> = {}): PayrollConcept => ({
  id,
  school_id: "s",
  name: id,
  concept_kind: "earning",
  default_amount: 0,
  currency: "USD",
  is_active: true,
  is_islr_taxable: true,
  is_contribution_base: true,
  is_base_salary: false,
  is_default: false,
  default_categories: [],
  ...overrides,
});

const salary = concept("Sueldo base", { default_amount: 1.5, is_default: true, is_base_salary: true });
const bonus = concept("Bono", { default_amount: 10, is_default: true });
const teachersOnly = concept("Prima docente", { default_amount: 5, is_default: true, default_categories: ["teacher"] });
const loan = concept("Préstamo", { concept_kind: "deduction", currency: "VES" });
const inactive = concept("Viejo", { is_default: true, is_active: false });

const names = (lines: ReturnType<typeof defaultConceptLines>) => lines.map((l) => `${l.concept.name}=${l.amount}`);

describe("conceptos por defecto al registrar un pago", () => {
  it("trae los marcados para todos, sin los inactivos", () => {
    expect(names(defaultConceptLines([salary, bonus, teachersOnly, loan, inactive], "worker", []))).toEqual([
      "Sueldo base=1.5",
      "Bono=10",
    ]);
  });

  it("agrega los de su categoría", () => {
    expect(names(defaultConceptLines([salary, teachersOnly], "teacher", []))).toEqual(["Sueldo base=1.5", "Prima docente=5"]);
  });

  it("usa el monto propio del trabajador, quita los que no le tocan y agrega los suyos", () => {
    const lines = defaultConceptLines([salary, bonus, loan], "worker", [
      { concept_id: "Sueldo base", enabled: true, amount: 3 },
      { concept_id: "Bono", enabled: false, amount: null },
      { concept_id: "Préstamo", enabled: true, amount: 200 },
    ]);
    expect(names(lines)).toEqual(["Sueldo base=3", "Préstamo=200"]);
  });

  it("pone primero las asignaciones", () => {
    const lines = defaultConceptLines([concept("Desc", { concept_kind: "deduction", is_default: true }), salary], "worker", []);
    expect(lines.map((l) => l.concept.concept_kind)).toEqual(["earning", "deduction"]);
  });

  it("elige la moneda del pago cuando todos coinciden", () => {
    expect(sharedCurrency(defaultConceptLines([salary, bonus], "worker", []))).toBe("USD");
    expect(sharedCurrency(defaultConceptLines([salary, loan], "worker", [{ concept_id: "Préstamo", enabled: true, amount: 1 }]))).toBeNull();
  });

  it("convierte a la moneda del pago", () => {
    expect(amountInPaymentCurrency(1.5, "USD", "VES", 887.303)).toBe(1330.95);
    expect(amountInPaymentCurrency(1.5, "USD", "USD", 0)).toBe(1.5);
    expect(amountInPaymentCurrency(1.5, "USD", "VES", 0)).toBeNull();
  });

  it("describe a quién aplica", () => {
    expect(defaultCategoriesLabel(salary)).toBe("Todos");
    expect(defaultCategoriesLabel(teachersOnly)).toBe("Docente");
    expect(defaultCategoriesLabel(loan)).toBe("No");
  });
});
