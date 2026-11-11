import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PayrollPeriodEditModal } from "./PayrollPeriodEditModal";
import { PayrollConceptEditModal } from "./PayrollConceptEditModal";
import type { PayrollConcept, PayrollPeriod } from "@/lib/payroll/types";

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const period: PayrollPeriod = {
  id: "p1",
  school_id: "s1",
  name: "Noviembre 2026 1era quincena",
  period_type: "biweekly",
  start_date: "2026-11-01",
  end_date: "2026-11-15",
  status: "open",
  school_year_id: null,
  apply_deductions: false,
};

const concept = {
  id: "c1",
  school_id: "s1",
  name: "Sueldo base",
  concept_kind: "earning",
  default_amount: 300,
  currency: "USD",
  is_active: true,
  is_islr_taxable: true,
  is_contribution_base: true,
  is_base_salary: true,
  is_default: true,
  default_categories: [],
} as PayrollConcept;

beforeEach(() => vi.clearAllMocks());

describe("PayrollPeriodEditModal", () => {
  it("loads the period and saves the changes", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<PayrollPeriodEditModal period={period} saving={false} onClose={onClose} onSave={onSave} />);

    const name = screen.getByLabelText("Nombre");
    expect(name).toHaveValue("Noviembre 2026 1era quincena");
    fireEvent.change(name, { target: { value: "Noviembre 2026 1ra quincena" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-11-14" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        id: "p1",
        name: "Noviembre 2026 1ra quincena",
        period_type: "biweekly",
        start_date: "2026-11-01",
        end_date: "2026-11-14",
        apply_deductions: false,
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("refuses an end date before the start", () => {
    const onSave = vi.fn();
    render(<PayrollPeriodEditModal period={period} saving={false} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-30" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });

  it("shows the database's refusal and stays open", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("El período ya tiene pagos"));
    const onClose = vi.fn();
    render(<PayrollPeriodEditModal period={period} saving={false} onClose={onClose} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: "El período ya tiene pagos" }))
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("PayrollConceptEditModal", () => {
  it("loads the concept and saves name and amount", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<PayrollConceptEditModal concept={concept} saving={false} onClose={vi.fn()} onSave={onSave} />);

    expect(screen.getByLabelText("Nombre")).toHaveValue("Sueldo base");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Salario base" } });
    fireEvent.change(screen.getByLabelText("Monto por defecto"), { target: { value: "350.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        id: "c1",
        name: "Salario base",
        concept_kind: "earning",
        default_amount: 350.5,
        currency: "USD",
      })
    );
  });

  it("doesn't save a negative amount", () => {
    const onSave = vi.fn();
    render(<PayrollConceptEditModal concept={concept} saving={false} onClose={vi.fn()} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Monto por defecto"), { target: { value: "-5" } });
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});
