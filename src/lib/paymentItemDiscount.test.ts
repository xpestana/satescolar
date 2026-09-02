import { describe, it, expect } from "vitest";
import {
  computeAdHocDiscount,
  settlesInstallment,
  validateAdHocDiscount,
  sumDiscountVes,
  itemCoverageVes,
  itemCoverageOriginal,
} from "./paymentItemDiscount";

const USD_RATE = 156.37;

describe("computeAdHocDiscount", () => {
  it("sin descuento devuelve el pendiente completo por cobrar", () => {
    const c = computeAdHocDiscount({ type: "none", value: 0, pendingOriginal: 100, rate: USD_RATE });
    expect(c.discountOriginal).toBe(0);
    expect(c.discountVes).toBe(0);
    expect(c.amountToPayVes).toBe(parseFloat((100 * USD_RATE).toFixed(2)));
  });

  it("porcentaje del pendiente en un concepto en USD", () => {
    const c = computeAdHocDiscount({ type: "percentage", value: 50, pendingOriginal: 100, rate: USD_RATE });
    expect(c.discountOriginal).toBe(50);
    expect(c.discountVes).toBe(7818.5);
    expect(c.amountToPayVes).toBe(parseFloat((100 * USD_RATE).toFixed(2)) - 7818.5);
    expect(c.clamped).toBe(false);
  });

  it("100% deja la cuota sin efectivo por cobrar", () => {
    const c = computeAdHocDiscount({ type: "percentage", value: 100, pendingOriginal: 80, rate: USD_RATE });
    expect(c.amountToPayVes).toBe(0);
    expect(settlesInstallment(0, c.discountVes, parseFloat((80 * USD_RATE).toFixed(2)))).toBe(true);
  });

  it("monto fijo mayor que el pendiente se topa al pendiente", () => {
    const c = computeAdHocDiscount({ type: "fixed", value: 200, pendingOriginal: 75, rate: USD_RATE });
    expect(c.discountOriginal).toBe(75);
    expect(c.amountToPayVes).toBe(0);
    expect(c.clamped).toBe(true);
  });

  it("concepto en VES (tasa 1)", () => {
    const c = computeAdHocDiscount({ type: "fixed", value: 500, pendingOriginal: 1200, rate: 1 });
    expect(c.discountVes).toBe(500);
    expect(c.amountToPayVes).toBe(700);
  });

  it("efectivo + descuento reconstruyen el pendiente pese al redondeo", () => {
    const pendingOriginal = 33.333;
    const c = computeAdHocDiscount({ type: "percentage", value: 33.33, pendingOriginal, rate: USD_RATE });
    const pendingVes = parseFloat((pendingOriginal * USD_RATE).toFixed(2));
    expect(Math.abs(c.amountToPayVes + c.discountVes - pendingVes)).toBeLessThanOrEqual(0.01);
  });

  it("valores negativos no generan descuento", () => {
    const c = computeAdHocDiscount({ type: "fixed", value: -50, pendingOriginal: 100, rate: 1 });
    expect(c.discountVes).toBe(0);
    expect(c.amountToPayVes).toBe(100);
  });
});

describe("settlesInstallment", () => {
  it("absorbe un residual dentro de la tolerancia", () => {
    expect(settlesInstallment(900, 100.0, 1000.005)).toBe(true);
  });
  it("no salda si falta más que la tolerancia", () => {
    expect(settlesInstallment(900, 95, 1000)).toBe(false);
  });
});

describe("validateAdHocDiscount", () => {
  const ok = { type: "fixed" as const, value: "15", reason: "Ingresó a mitad de mes" };

  it("acepta un descuento válido", () => {
    expect(validateAdHocDiscount(ok, 100, "Mensualidad")).toBeNull();
  });
  it("exige motivo", () => {
    expect(validateAdHocDiscount({ ...ok, reason: "  " }, 100, "Mensualidad")).toContain("motivo");
  });
  it("rechaza valores no positivos", () => {
    expect(validateAdHocDiscount({ ...ok, value: "-3" }, 100, "Mensualidad")).toContain("mayor a 0");
  });
  it("rechaza porcentajes mayores a 100", () => {
    expect(validateAdHocDiscount({ type: "percentage", value: "120", reason: "x" }, 100, "Mensualidad")).toContain("100%");
  });
  it("rechaza un monto fijo mayor al pendiente", () => {
    expect(validateAdHocDiscount({ ...ok, value: "500" }, 100, "Mensualidad")).toContain("supera el pendiente");
  });
  it("ignora el tipo none", () => {
    expect(validateAdHocDiscount({ type: "none", value: "", reason: "" }, 100, "Mensualidad")).toBeNull();
  });
});

describe("sumDiscountVes / itemCoverage", () => {
  it("suma vacía es 0", () => {
    expect(sumDiscountVes([])).toBe(0);
  });
  it("suma los descuentos en VES", () => {
    expect(sumDiscountVes([{ discountVes: 100 }, { discountVes: 50.5 }])).toBe(150.5);
  });
  it("cobertura de un item legacy sin columnas de descuento", () => {
    expect(itemCoverageVes({ amount_ves: 1200 } as any)).toBe(1200);
  });
  it("cobertura = efectivo + descuento", () => {
    expect(itemCoverageVes({ amount_ves: 700, discount_amount_ves: 500 })).toBe(1200);
  });
  it("cobertura en moneda original usa los montos originales cuando existen", () => {
    expect(itemCoverageOriginal({ amount_ves: 7818.5, original_amount: 50, discount_amount_ves: 7818.5, discount_original_amount: 50 }, USD_RATE)).toBe(100);
  });
  it("cobertura en moneda original cae a la tasa snapshot en items antiguos", () => {
    expect(itemCoverageOriginal({ amount_ves: 156.37 }, USD_RATE)).toBeCloseTo(1, 6);
  });
});
