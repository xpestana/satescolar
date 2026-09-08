import { describe, it, expect } from "vitest";
import {
  computeExonerationSettlement,
  exonerablePendingVes,
  exonerableRemainingOriginal,
  exonerableTotalOriginal,
  type ExonerableBalance,
} from "./conceptExonerationMath";

/** Cuota tipo del ledger; los tests sobreescriben lo que les interesa. */
const balance = (over: Partial<ExonerableBalance> = {}): ExonerableBalance => ({
  id: "b1",
  school_id: "s1",
  school_year_id: "y1",
  student_id: "st1",
  plan_concept_id: "pc1",
  currency: "VES",
  original_amount: 1000,
  exchange_rate_snapshot: 1,
  total_amount: 1000,
  paid_amount: 0,
  balance: 1000,
  ...over,
});

describe("exonerableRemainingOriginal", () => {
  it("en VES el pendiente ya está en la moneda del concepto", () => {
    expect(exonerableRemainingOriginal(balance())).toBe(1000);
  });

  it("en USD devuelve los dólares: el saldo VES entre la tasa congelada", () => {
    const b = balance({ currency: "USD", original_amount: 75, exchange_rate_snapshot: 813.7361, balance: 61030.21 });
    expect(exonerableRemainingOriginal(b)).toBeCloseTo(75, 4);
  });

  it("sin tasa congelada no divide (fila legacy con snapshot 0/null)", () => {
    const b = balance({ currency: "USD", exchange_rate_snapshot: 0, balance: 500 });
    expect(exonerableRemainingOriginal(b)).toBe(500);
  });

  it("un saldo negativo no genera pendiente por exonerar", () => {
    expect(exonerableRemainingOriginal(balance({ balance: -50 }))).toBe(0);
  });
});

describe("exonerablePendingVes", () => {
  it("en VES la tasa no interviene", () => {
    expect(exonerablePendingVes(balance(), 349.93)).toBe(1000);
  });

  it("sin tasa del día conserva los bolívares almacenados (estado de cuenta)", () => {
    const b = balance({ currency: "USD", original_amount: 75, exchange_rate_snapshot: 813.7361, balance: 61030.21 });
    expect(exonerablePendingVes(b)).toBeCloseTo(61030.21, 2);
  });

  it("con snapshot igual a la tasa del día el monto no se mueve", () => {
    const b = balance({ currency: "USD", original_amount: 75, exchange_rate_snapshot: 349.93, balance: 26244.75 });
    expect(exonerablePendingVes(b, 349.93)).toBeCloseTo(26244.75, 2);
  });

  it("revalúa a la tasa del día: 75 USD congelados a 813,74 se exoneran a 349,93", () => {
    // Caso reportado: la insignia decía 61.030,21 mientras la columna Pendiente decía 26.244,75
    const b = balance({ currency: "USD", original_amount: 75, exchange_rate_snapshot: 813.7361, balance: 61030.21 });
    expect(exonerablePendingVes(b, 349.93)).toBeCloseTo(26244.75, 2);
  });

  it("una cuota abonada exonera solo el remanente, revaluado", () => {
    // 75 USD, ya abonados 25 USD → quedan 50 USD pendientes
    const b = balance({
      currency: "USD",
      original_amount: 75,
      exchange_rate_snapshot: 200,
      total_amount: 15000,
      paid_amount: 5000,
      balance: 10000,
    });
    expect(exonerableRemainingOriginal(b)).toBe(50);
    expect(exonerablePendingVes(b, 349.93)).toBeCloseTo(50 * 349.93, 2);
  });

  it("una cuota saldada no deja nada por exonerar", () => {
    const b = balance({ currency: "USD", balance: 0, exchange_rate_snapshot: 349.93 });
    expect(exonerablePendingVes(b, 349.93)).toBe(0);
  });

  it("una tasa del día inválida cae a la tasa congelada", () => {
    const b = balance({ currency: "USD", original_amount: 75, exchange_rate_snapshot: 349.93, balance: 26244.75 });
    expect(exonerablePendingVes(b, 0)).toBeCloseTo(26244.75, 2);
  });
});

describe("exonerableTotalOriginal", () => {
  it("usa el total en moneda original cuando está guardado", () => {
    expect(exonerableTotalOriginal(balance({ currency: "USD", original_amount: 75 }))).toBe(75);
  });

  it("filas viejas sin original_amount lo deducen del total y la tasa congelada", () => {
    const b = balance({ currency: "USD", original_amount: null, exchange_rate_snapshot: 200, total_amount: 15000 });
    expect(exonerableTotalOriginal(b)).toBe(75);
  });
});

describe("computeExonerationSettlement", () => {
  it("cierra la cuota conservando paid_amount + balance = total_amount", () => {
    const b = balance({ currency: "USD", original_amount: 75, exchange_rate_snapshot: 813.7361, balance: 61030.21 });
    const s = computeExonerationSettlement(b, 349.93);
    expect(s.rate).toBe(349.93);
    expect(s.pendingOriginal).toBeCloseTo(75, 4);
    expect(s.pendingVes).toBeCloseTo(26244.75, 2);
    // El ledger queda revaluado: total = paid (balance 0), igual que tras un cobro
    expect(s.newTotalVes).toBeCloseTo(26244.75, 2);
  });

  it("una cuota abonada revalúa el total completo, no solo el remanente", () => {
    // 75 USD con 25 USD ya abonados; se exoneran los 50 USD que quedan
    const b = balance({
      currency: "USD",
      original_amount: 75,
      exchange_rate_snapshot: 200,
      total_amount: 15000,
      paid_amount: 5000,
      balance: 10000,
    });
    const s = computeExonerationSettlement(b, 349.93);
    expect(s.pendingOriginal).toBe(50);
    expect(s.pendingVes).toBeCloseTo(50 * 349.93, 2);
    expect(s.newTotalVes).toBeCloseTo(75 * 349.93, 2);
  });

  it("en VES la tasa es 1 y el total no se toca", () => {
    const s = computeExonerationSettlement(balance(), 349.93);
    expect(s.rate).toBe(1);
    expect(s.pendingVes).toBe(1000);
    expect(s.newTotalVes).toBe(1000);
  });

  it("sin tasa del día se conserva la congelada (comportamiento previo)", () => {
    const b = balance({ currency: "USD", original_amount: 75, exchange_rate_snapshot: 813.7361, balance: 61030.21 });
    const s = computeExonerationSettlement(b);
    expect(s.rate).toBe(813.7361);
    expect(s.pendingVes).toBeCloseTo(61030.21, 2);
  });
});
