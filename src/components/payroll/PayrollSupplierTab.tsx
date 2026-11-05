import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, FileText, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { usePayrollPayments } from "@/hooks/payroll/usePayrollPayments";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { BeneficiaryFormModal } from "@/components/payroll/BeneficiaryFormModal";
import { PayrollPaymentActions } from "@/components/payroll/PayrollPaymentActions";
import { SupplierPaymentFormModal } from "@/components/payroll/SupplierPaymentFormModal";
import { PayrollGuide } from "@/components/payroll/PayrollGuide";
import { supplierGuide } from "@/components/payroll/payrollGuides";
import { CATEGORY_LABELS, STATUS_LABELS, type PayrollBeneficiary, type PayrollPaymentStatus } from "@/lib/payroll/types";

interface PayrollSupplierTabProps {
  schoolId: string;
  periodId: string;
  beneficiaries: PayrollBeneficiary[];
  canRegister: boolean;
  canApprove: boolean;
}

const statusVariant = (s: PayrollPaymentStatus) =>
  s === "paid" ? "default" : s === "voided" ? "destructive" : s === "approved" ? "secondary" : "outline";

const money = (value: number) => value.toLocaleString("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Suppliers and fee earners: several invoices per period, each with its own withholdings. */
export function PayrollSupplierTab({ schoolId, periodId, beneficiaries, canRegister, canApprove }: PayrollSupplierTabProps) {
  const qc = useQueryClient();
  const { payments } = usePayrollPayments(schoolId, { periodId });
  const { vatEnabled, islrEnabled } = usePayrollTaxConfig(schoolId);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [registerFor, setRegisterFor] = useState<PayrollBeneficiary | null>(null);
  const [pendingSupplierId, setPendingSupplierId] = useState<string | null>(null);

  const suppliers = useMemo(
    () => beneficiaries.filter((b) => b.is_active && b.payment_regime === "invoice"),
    [beneficiaries]
  );
  const rows = useMemo(() => payments.filter((p) => p.payment_kind === "invoice"), [payments]);

  // A supplier just created opens straight into its invoice, once the list has it.
  useEffect(() => {
    if (!pendingSupplierId) return;
    const created = suppliers.find((s) => s.id === pendingSupplierId);
    if (created) {
      setPendingSupplierId(null);
      setRegisterFor(created);
    }
  }, [pendingSupplierId, suppliers]);

  return (
    <>
      <PayrollGuide guide={supplierGuide({ vatEnabled, islrEnabled })} />

      <div className="flex flex-wrap gap-3 mb-4">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button disabled={!canRegister} role="combobox" aria-expanded={pickerOpen}>
              <FileText className="h-4 w-4 mr-1" />Registrar factura
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar proveedor..." />
              <CommandList>
                <CommandEmpty>No se encontró ningún proveedor.</CommandEmpty>
                <CommandGroup>
                  {suppliers.map((s) => (
                    <CommandItem
                      key={s.id}
                      value={`${s.full_name} ${s.tax_id ?? ""} ${s.document_id ?? ""}`}
                      onSelect={() => { setRegisterFor(s); setPickerOpen(false); }}
                    >
                      <span className="truncate">{s.full_name}</span>
                      <span className="ml-auto pl-2 text-xs text-muted-foreground">{s.tax_id || s.document_id || "—"}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button variant="outline" disabled={!canRegister} onClick={() => setNewSupplierOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />Nuevo proveedor
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Factura</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Retenido</TableHead>
                <TableHead className="text-right">Neto (VES)</TableHead>
                <TableHead className="w-52">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hay facturas registradas en este período.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((p) => (
                  <TableRow key={p.id} className={p.status === "voided" ? "opacity-60" : ""}>
                    <TableCell className="font-medium">
                      {p.payroll_beneficiaries?.full_name ?? "—"}
                      <div className="text-xs text-muted-foreground">
                        {p.payroll_beneficiaries?.tax_id || p.payroll_beneficiaries?.document_id || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {p.payroll_purchase_documents?.map((d) => d.document_number).join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {p.payroll_beneficiaries && (
                        <Badge variant="outline">{CATEGORY_LABELS[p.payroll_beneficiaries.category]}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(p.status)}>{STATUS_LABELS[p.status]}</Badge>
                      {p.status === "paid" && p.payment_reference && (
                            <div className="text-xs text-muted-foreground">Ref. {p.payment_reference}</div>
                          )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">{p.currency} {money(p.gross_amount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{p.currency} {money(p.deductions_amount)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">{money(p.net_amount_ves)}</TableCell>
                    <TableCell>
                      <PayrollPaymentActions schoolId={schoolId} payment={p} canApprove={canApprove} allowVoidPaid />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <BeneficiaryFormModal
        open={newSupplierOpen}
        onOpenChange={setNewSupplierOpen}
        schoolId={schoolId}
        initialCategory="supplier"
        onSaved={(id) => {
          setPendingSupplierId(id);
          qc.invalidateQueries({ queryKey: ["payroll-beneficiaries", schoolId] });
        }}
      />

      {registerFor && (
        <SupplierPaymentFormModal
          open={!!registerFor}
          onOpenChange={(v) => !v && setRegisterFor(null)}
          schoolId={schoolId}
          periodId={periodId}
          supplier={registerFor}
        />
      )}
    </>
  );
}
