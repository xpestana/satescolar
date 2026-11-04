import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { BeneficiaryFormModal } from "./BeneficiaryFormModal";

// jsdom has no ResizeObserver, and the radio group needs one.
vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

const createBeneficiary = vi.fn();
const addAriRate = vi.fn();
let teachers: { id: string; name: string; document_id: string; email: string | null; phone: string | null; isSuspended: boolean }[] = [];
let taxConfig = { vatEnabled: false, islrEnabled: false, concepts: [] as unknown[] };

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ has: () => true }) }));
vi.mock("@/hooks/useSchoolModules", () => ({ useSchoolModules: () => ({ isActive: () => true }) }));
vi.mock("@/hooks/payroll/usePayrollBeneficiaries", () => ({
  usePayrollBeneficiaries: () => ({
    createBeneficiary: { mutateAsync: createBeneficiary, isPending: false },
    updateBeneficiary: { mutateAsync: vi.fn(), isPending: false },
  }),
}));
vi.mock("@/hooks/payroll/usePayrollTeachers", () => ({ usePayrollTeachers: () => ({ data: teachers }) }));
vi.mock("@/hooks/payroll/usePayrollTaxConfig", () => ({ usePayrollTaxConfig: () => taxConfig }));
vi.mock("@/hooks/payroll/usePayrollAriRates", () => ({
  usePayrollAriRates: () => ({ ratesByBeneficiary: {}, addAriRate: { mutateAsync: addAriRate } }),
}));

const renderForm = (initialCategory: "supplier" | "teacher" | "worker" = "worker") =>
  render(
    <MemoryRouter>
      <BeneficiaryFormModal open onOpenChange={vi.fn()} schoolId="s1" initialCategory={initialCategory} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  createBeneficiary.mockResolvedValue("new-id");
  teachers = [];
  taxConfig = { vatEnabled: false, islrEnabled: false, concepts: [] };
});

describe("BeneficiaryFormModal", () => {
  it("doesn't ask staff for fiscal data when withholdings are off", () => {
    renderForm("worker");
    expect(screen.getByText("Cédula o pasaporte *")).toBeInTheDocument();
    expect(screen.getByText("RIF")).toBeInTheDocument();
    expect(screen.queryByText(/Domicilio fiscal/)).not.toBeInTheDocument();
    expect(screen.queryByText(/AR-I/)).not.toBeInTheDocument();
  });

  it("asks staff for RIF and AR-I when ISLR is on", () => {
    taxConfig = { vatEnabled: true, islrEnabled: true, concepts: [] };
    renderForm("worker");
    expect(screen.getByText("RIF *")).toBeInTheDocument();
    expect(screen.getByText("% AR-I *")).toBeInTheDocument();
  });

  it("asks a supplier for all its fiscal data", () => {
    renderForm("supplier");
    expect(screen.getByText("Tipo de persona *")).toBeInTheDocument();
    expect(screen.getByText("RIF *")).toBeInTheDocument();
    expect(screen.getByText("Domicilio fiscal *")).toBeInTheDocument();
    expect(screen.getByText("Correo *")).toBeInTheDocument();
    expect(screen.getByText("Retención de IVA *")).toBeInTheDocument();
  });

  it("won't save a supplier without its mandatory data", async () => {
    renderForm("supplier");
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    expect(await screen.findByText("El RIF es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("El domicilio fiscal es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("El correo es obligatorio")).toBeInTheDocument();
    expect(createBeneficiary).not.toHaveBeenCalled();
  });

  it("registers a teacher only in payroll when there are no active teachers", async () => {
    teachers = [{ id: "t1", name: "Suspendida", document_id: "V-1", email: null, phone: null, isSuspended: true }];
    renderForm("teacher");
    expect(screen.getByText(/No hay docentes activos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "agregarlo en Docentes" })).toHaveAttribute("href", "/registros/docentes/nuevo");

    fireEvent.change(screen.getByPlaceholderText("Nombre y apellido"), { target: { value: "Ana Pérez" } });
    fireEvent.change(screen.getByPlaceholderText("12345678"), { target: { value: "12345678" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));

    await waitFor(() => expect(createBeneficiary).toHaveBeenCalledTimes(1));
    expect(createBeneficiary.mock.calls[0][0]).toMatchObject({
      category: "teacher",
      teacher_id: null,
      document_id: "V-12345678",
      full_name: "Ana Pérez",
    });
  });

  it("offers both paths when there are active teachers", async () => {
    teachers = [{ id: "t1", name: "Ana Pérez", document_id: "V-12345678", email: null, phone: null, isSuspended: false }];
    renderForm("teacher");
    expect(screen.getByLabelText("Vincular un docente registrado")).toBeChecked();
    fireEvent.click(screen.getByLabelText("Registrar solo en Nómina"));
    expect(screen.getByText(/No crea cuenta ni acceso/)).toBeInTheDocument();
  });

  it("links automatically when the document matches a registered teacher", async () => {
    teachers = [{ id: "t1", name: "Ana Pérez", document_id: "V-12345678", email: null, phone: null, isSuspended: false }];
    renderForm("teacher");
    fireEvent.click(screen.getByLabelText("Registrar solo en Nómina"));
    fireEvent.change(screen.getByPlaceholderText("Nombre y apellido"), { target: { value: "Ana P" } });
    fireEvent.change(screen.getByPlaceholderText("12345678"), { target: { value: "12345678" } });
    expect(screen.getByText(/se vinculará al guardar/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(createBeneficiary).toHaveBeenCalled());
    expect(createBeneficiary.mock.calls[0][0].teacher_id).toBe("t1");
  });

  it("saves the AR-I as a dated version", async () => {
    taxConfig = { vatEnabled: false, islrEnabled: true, concepts: [] };
    renderForm("worker");
    fireEvent.change(screen.getByPlaceholderText("Nombre y apellido"), { target: { value: "Luis" } });
    fireEvent.change(screen.getByPlaceholderText("12345678"), { target: { value: "7654321" } });
    fireEvent.change(screen.getByPlaceholderText("J-12345678-9"), { target: { value: "V-07654321-0" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(addAriRate).toHaveBeenCalled());
    expect(addAriRate.mock.calls[0][0]).toMatchObject({ beneficiary_id: "new-id", rate_pct: 2.5 });
  });
});
