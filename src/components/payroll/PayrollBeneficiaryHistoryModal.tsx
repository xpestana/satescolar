import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { buildPayrollReceiptData } from "@/lib/payroll/buildPayrollReceiptData";
import { downloadPayrollReceiptPdf } from "@/lib/payroll/generatePayrollReceiptPdf";
import { STATUS_LABELS, type PayrollLineItem, type PayrollCategory, type PayrollCurrency, type PayrollMethodType, type PayrollPaymentStatus } from "@/lib/payroll/types";
import type { PayrollPaymentRow } from "@/hooks/payroll/usePayrollPayments";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  schoolName: string;
  beneficiary: { id: string; full_name: string; document_id: string | null; category: PayrollCategory };
}

export function PayrollBeneficiaryHistoryModal({ open, onOpenChange, schoolId, schoolName, beneficiary }: Props) {
  const { toast } = useToast();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payroll-beneficiary-history", beneficiary.id],
    enabled: open && !!beneficiary.id,
    queryFn: async (): Promise<PayrollPaymentRow[]> => {
      const { data, error } = await supabase
        .from("payroll_payments")
        .select(
          "*, payroll_beneficiaries(id, full_name, document_id, category), payroll_periods(id, name, period_type), payroll_payment_methods(id, method_type, label)"
        )
        .eq("school_id", schoolId)
        .eq("beneficiary_id", beneficiary.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PayrollPaymentRow[];
    },
  });

  const totalPaidVes = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (p.net_amount_ves || 0), 0);

  const downloadReceipt = async (p: PayrollPaymentRow) => {
    const { data: itemsData, error } = await supabase
      .from("payroll_payment_items")
      .select("concept_id, concept_kind, description, amount")
      .eq("payment_id", p.id);
    if (error) {
      toast({ title: "Error al generar el recibo", description: error.message, variant: "destructive" });
      return;
    }
    const receipt = buildPayrollReceiptData({
      schoolName,
      beneficiaryName: p.payroll_beneficiaries?.full_name ?? beneficiary.full_name,
      documentId: p.payroll_beneficiaries?.document_id ?? beneficiary.document_id,
      category: (p.payroll_beneficiaries?.category ?? beneficiary.category) as PayrollCategory,
      periodName: p.payroll_periods?.name ?? "—",
      periodStart: "",
      periodEnd: "",
      currency: p.currency as PayrollCurrency,
      exchangeRate: p.exchange_rate,
      items: (itemsData ?? []) as unknown as PayrollLineItem[],
      methodType: (p.payroll_payment_methods?.method_type ?? null) as PayrollMethodType | null,
      methodLabel: p.payroll_payment_methods?.label ?? null,
      paymentDate: p.payment_date,
      notes: p.notes,
    });
    downloadPayrollReceiptPdf(receipt, `recibo-${beneficiary.full_name}-${p.payroll_periods?.name ?? ""}`);
  };

  const badgeVariant = (s: PayrollPaymentStatus) =>
    s === "paid" ? "default" : s === "voided" ? "destructive" : s === "approved" ? "secondary" : "outline";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historial — {beneficiary.full_name}</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 mb-3 text-sm">
          <span className="text-muted-foreground">Total pagado (VES): </span>
          <span className="font-semibold">{totalPaidVes.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Período</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Neto</TableHead>
              <TableHead>Neto (VES)</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Cargando...</TableCell></TableRow>
            ) : payments.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Sin pagos registrados.</TableCell></TableRow>
            ) : (
              payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.payroll_periods?.name ?? "—"}</TableCell>
                  <TableCell><Badge variant={badgeVariant(p.status)}>{STATUS_LABELS[p.status]}</Badge></TableCell>
                  <TableCell>{p.net_amount.toLocaleString("es-VE", { minimumFractionDigits: 2 })} {p.currency}</TableCell>
                  <TableCell>{p.net_amount_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" title="Descargar recibo" onClick={() => downloadReceipt(p)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
