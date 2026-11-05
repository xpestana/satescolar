import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PayrollGuide, type PayrollGuideContent } from "./PayrollGuide";
import {
  beneficiariesGuide,
  overviewGuide,
  staffGuide,
  supplierGuide,
  withholdingsConfigGuide,
  withholdingsPeriodGuide,
} from "./payrollGuides";

const OFF = { vatEnabled: false, islrEnabled: false };
const ON = { vatEnabled: true, islrEnabled: true };

function textOf(guide: PayrollGuideContent) {
  const { container, unmount } = render(<PayrollGuide guide={guide} />);
  const text = container.textContent ?? "";
  unmount();
  return text;
}

function installStorage(overrides: Partial<Storage> = {}) {
  const items = new Map<string, string>();
  const storage = {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    get length() { return items.size; },
    ...overrides,
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
  return storage;
}

describe("PayrollGuide", () => {
  beforeEach(() => { installStorage(); });

  it("opens by default and remembers when it was hidden", () => {
    const guide = staffGuide(OFF);
    const { unmount } = render(<PayrollGuide guide={guide} />);
    expect(screen.getByText("Registrar pago")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));
    expect(screen.queryByText("Registrar pago")).not.toBeInTheDocument();
    unmount();

    render(<PayrollGuide guide={guide} />);
    expect(screen.queryByText("Registrar pago")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ver instrucciones/ }));
    expect(screen.getByText("Registrar pago")).toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });

  it("still works when the browser blocks storage", () => {
    installStorage({ setItem: () => { throw new Error("blocked"); } });
    render(<PayrollGuide guide={staffGuide(OFF)} />);
    fireEvent.click(screen.getByRole("button", { name: /Ocultar/ }));
    expect(screen.getByRole("button", { name: /Ver instrucciones/ })).toBeInTheDocument();
  });
});

describe("guides adapt to each school", () => {
  it("doesn't talk about withholding steps to a school without them", () => {
    expect(textOf(staffGuide(OFF))).not.toMatch(/AR-I|Complete en Beneficiarios/);
    expect(textOf(supplierGuide(OFF))).not.toMatch(/concepto de ISLR|Recalcular|comprobante/i);
    expect(textOf(beneficiariesGuide(OFF))).not.toMatch(/AR-I|concepto de ISLR/);
    expect(textOf(overviewGuide(OFF))).toContain("no tiene retenciones activas");
  });

  it("shows only the tax this school withholds", () => {
    const vatOnly = { vatEnabled: true, islrEnabled: false };
    expect(textOf(overviewGuide(vatOnly))).toContain("retiene IVA.");
    expect(textOf(supplierGuide(vatOnly))).toContain("Caja chica");
    expect(textOf(supplierGuide(vatOnly))).not.toContain("concepto de ISLR");
    expect(textOf(staffGuide(vatOnly))).not.toContain("AR-I");

    const islrOnly = { vatEnabled: false, islrEnabled: true };
    expect(textOf(overviewGuide(islrOnly))).toContain("retiene ISLR.");
    expect(textOf(supplierGuide(islrOnly))).toContain("concepto de ISLR");
    expect(textOf(supplierGuide(islrOnly))).not.toContain("Caja chica");
  });

  it("explains every withholding step when both are on", () => {
    expect(textOf(overviewGuide(ON))).toContain("retiene IVA e ISLR");
    expect(textOf(staffGuide(ON))).toContain("AR-I");
    expect(textOf(supplierGuide(ON))).toContain("Recalcular");
  });

  it("asks to load the starting values only before configuring", () => {
    expect(textOf(withholdingsConfigGuide(false))).toContain("Configurar retenciones");
    expect(textOf(withholdingsConfigGuide(true))).not.toContain("Pulsa Configurar retenciones");
  });

  it("uses the fortnight for IVA and the month for ISLR", () => {
    expect(textOf(withholdingsPeriodGuide("vat"))).toContain("quincena");
    expect(textOf(withholdingsPeriodGuide("islr"))).toContain("mes");
    expect(textOf(withholdingsPeriodGuide("islr"))).toContain("Comprobante anual");
  });
});
