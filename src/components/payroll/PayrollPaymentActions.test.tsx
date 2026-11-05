import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PayrollPaymentActions } from "./PayrollPaymentActions";
import type { PayrollPaymentRow } from "@/hooks/payroll/usePayrollPayments";

const markPaid = vi.fn();
const toast = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/hooks/payroll/usePayrollRecalculate", () => ({
  usePayrollRecalculate: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/payroll/usePayrollPayments", () => ({
  usePayrollPayments: () => ({
    approvePayment: { mutate: vi.fn(), isPending: false },
    markPaid: { mutate: markPaid, isPending: false },
    voidPayment: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/lib/dateUtils", async (original) => ({
  ...(await original<typeof import("@/lib/dateUtils")>()),
  todayCaracasIso: () => "2026-11-05",
}));

const payment = {
  id: "p1",
  status: "approved",
  currency: "VES",
  net_amount: 870,
  payroll_beneficiaries: { full_name: "Trabajador Prueba" },
} as unknown as PayrollPaymentRow;

function openPayDialog() {
  render(<PayrollPaymentActions schoolId="s1" payment={payment} canApprove />);
  fireEvent.click(screen.getByRole("button", { name: /Pagar/ }));
}

describe("PayrollPaymentActions: pagar", () => {
  beforeEach(() => {
    markPaid.mockReset();
    toast.mockReset();
  });

  it("no paga sin referencia", () => {
    openPayDialog();
    expect(screen.getByText(/Trabajador Prueba/)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirmar pago" });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Referencia del pago *"), { target: { value: "   " } });
    expect(confirm).toBeDisabled();
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("no acepta una fecha futura", () => {
    openPayDialog();
    fireEvent.change(screen.getByLabelText("Referencia del pago *"), { target: { value: "000123" } });
    fireEvent.change(screen.getByLabelText("Fecha del pago *"), { target: { value: "2026-11-06" } });
    expect(screen.getByRole("button", { name: "Confirmar pago" })).toBeDisabled();
  });

  it("envía la referencia sin espacios y la fecha elegida", () => {
    openPayDialog();
    fireEvent.change(screen.getByLabelText("Referencia del pago *"), { target: { value: "  000123  " } });
    fireEvent.change(screen.getByLabelText("Fecha del pago *"), { target: { value: "2026-11-04" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pago" }));

    expect(markPaid).toHaveBeenCalledWith(
      { paymentId: "p1", reference: "000123", paymentDate: "2026-11-04" },
      expect.any(Object)
    );
  });

  it("avisa que no se envió el recibo cuando no hay correo", () => {
    markPaid.mockImplementation((_input, { onSuccess }) => onSuccess({ emailSent: false, reason: "no-email" }));
    openPayDialog();
    fireEvent.change(screen.getByLabelText("Referencia del pago *"), { target: { value: "000123" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar pago" }));

    expect(toast).toHaveBeenCalledWith({
      title: "Pago marcado como pagado",
      description: "No tiene correo registrado, así que no se envió el recibo.",
    });
  });
});
