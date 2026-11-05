import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollMethods } from "@/hooks/payroll/usePayrollMethods";
import { usePayrollPayments } from "@/hooks/payroll/usePayrollPayments";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { usePayrollUsdRate } from "@/hooks/payroll/usePayrollUsdRate";
import { MethodDetails } from "@/components/payroll/MethodDetails";
import { PurchaseDocumentFields, type EditableDocument } from "@/components/payroll/PurchaseDocumentFields";
import { todayCaracasIso } from "@/lib/dateUtils";
import { formatMoney } from "@/lib/payroll/buildPayrollReceiptData";
import { METHOD_LABELS, type PayrollBeneficiary, type PayrollCurrency } from "@/lib/payroll/types";
import { NO_ISLR_CONCEPT } from "@/lib/payroll/withholdings/beneficiaryFormSchema";
import { missingBeneficiaryData } from "@/lib/payroll/withholdings/beneficiaryRules";
import { buildSupplierPaymentDraft, type DraftDocumentInput } from "@/lib/payroll/withholdings/buildPaymentDraft";
import { resolveRateVersion } from "@/lib/payroll/withholdings/resolveRateVersion";

interface SupplierPaymentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  periodId: string;
  supplier: PayrollBeneficiary;
}

let documentCounter = 0;

export function SupplierPaymentFormModal({ open, onOpenChange, schoolId, periodId, supplier }: SupplierPaymentFormModalProps) {
  const { toast } = useToast();
  const { registerPayment } = usePayrollPayments(schoolId);
  const { methods } = usePayrollMethods(schoolId, supplier.id);
  const { data: usdRate = 0 } = usePayrollUsdRate(schoolId);
  const { vatEnabled, islrEnabled, parameters, concepts, rates } = usePayrollTaxConfig(schoolId);

  const today = todayCaracasIso();
  const currentParameters = resolveRateVersion(parameters, today);

  const newDocument = (): EditableDocument => ({
    key: `doc${documentCounter++}`,
    documentType: "invoice",
    documentNumber: "",
    controlNumber: "",
    issueDate: today,
    taxableBase: "",
    exemptAmount: "",
    vatRatePct: String(currentParameters?.default_vat_rate_pct ?? 16),
    vatAmount: "",
    totalAmount: "",
    islrConceptId: supplier.default_islr_concept_id ?? "",
    isPettyCash: false,
    isVatNotItemized: false,
    isNonCompliant: false,
    vatOverrideOn: false,
    vatOverridePct: "",
    islrOverrideOn: false,
    islrOverridePct: "",
    overrideReason: "",
  });

  const [currency, setCurrency] = useState<PayrollCurrency>("VES");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [methodId, setMethodId] = useState("");
  const [notes, setNotes] = useState("");
  const [documents, setDocuments] = useState<EditableDocument[]>([]);

  useEffect(() => {
    if (!open) return;
    setCurrency("VES");
    setExchangeRate("1");
    setMethodId("");
    setNotes("");
    setDocuments([newDocument()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier.id]);

  useEffect(() => {
    if (currency === "USD") setExchangeRate(usdRate > 0 ? String(usdRate) : "0");
    else setExchangeRate("1");
  }, [currency, usdRate]);

  const rate = Number(exchangeRate) || 0;
  const selectedMethod = methods.find((m) => m.id === methodId);

  const draft = useMemo(() => {
    const inputs: DraftDocumentInput[] = documents.map((d) => ({
      key: d.key,
      document_type: d.documentType,
      document_number: d.documentNumber.trim(),
      control_number: d.controlNumber.trim(),
      issue_date: d.issueDate,
      taxable_base: Number(d.taxableBase) || 0,
      exempt_amount: Number(d.exemptAmount) || 0,
      vat_rate_pct: Number(d.vatRatePct) || 0,
      vat_amount: Number(d.vatAmount) || 0,
      total_amount: Number(d.totalAmount) || 0,
      islr_concept_id: d.islrConceptId && d.islrConceptId !== NO_ISLR_CONCEPT ? d.islrConceptId : null,
      is_petty_cash: d.isPettyCash,
      is_vat_not_itemized: d.isVatNotItemized,
      is_non_compliant: d.isNonCompliant,
      vatOverride: d.vatOverrideOn && d.vatOverridePct !== "" ? { pct: Number(d.vatOverridePct), reason: d.overrideReason.trim() } : null,
      islrOverride: d.islrOverrideOn && d.islrOverridePct !== "" ? { pct: Number(d.islrOverridePct), reason: d.overrideReason.trim() } : null,
    }));
    return buildSupplierPaymentDraft({
      vatEnabled,
      islrEnabled,
      date: today,
      parameters,
      currency,
      exchangeRate: rate,
      personType: supplier.person_type,
      vatMode: supplier.vat_withholding_mode,
      vatExclusionReason: supplier.vat_exclusion_reason,
      concepts,
      rates,
      documents: inputs,
    });
  }, [documents, vatEnabled, islrEnabled, today, parameters, currency, rate, supplier, concepts, rates]);

  const missing = vatEnabled || islrEnabled ? missingBeneficiaryData(supplier, { vatEnabled, islrEnabled, hasAriRate: true }) : [];

  const problems = [
    ...missing.map((m) => `Falta en el proveedor: ${m}.`),
    ...draft.errors,
    ...documents.flatMap((d, index) => {
      const prefix = documents.length > 1 ? `Factura ${index + 1}: ` : "";
      const issues: string[] = [];
      if (!d.documentNumber.trim() || !d.controlNumber.trim() || !d.issueDate) issues.push(`${prefix}Indique número, control y fecha.`);
      if (islrEnabled && !d.islrConceptId) issues.push(`${prefix}Seleccione el concepto de ISLR.`);
      if ((d.vatOverrideOn && d.vatOverridePct === "") || (d.islrOverrideOn && d.islrOverridePct === "")) issues.push(`${prefix}Indique el porcentaje a aplicar.`);
      if ((d.vatOverrideOn || d.islrOverrideOn) && !d.overrideReason.trim()) issues.push(`${prefix}Indique el motivo del cambio de porcentaje.`);
      return issues;
    }),
  ];

  const canSubmit = problems.length === 0 && draft.totals.gross > 0 && draft.totals.net > 0 && (currency === "VES" || rate > 0);

  const updateDocument = (key: string, patch: Partial<EditableDocument>) =>
    setDocuments((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const handleSubmit = () => {
    if (!canSubmit) return;
    registerPayment.mutate(
      {
        period_id: periodId,
        beneficiary_id: supplier.id,
        payment_kind: "invoice",
        currency,
        exchange_rate: rate,
        payment_method_id: methodId || null,
        notes: notes.trim() || null,
        items: draft.items,
        documents: draft.documents,
        withholdings: draft.withholdings,
      },
      {
        onSuccess: () => {
          toast({ title: "Pago registrado en borrador", description: "Queda pendiente de aprobación." });
          onOpenChange(false);
        },
        onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">Registrar factura — {supplier.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 min-w-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as PayrollCurrency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VES">VES (Bs)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tasa (VES/USD)</Label>
              <Input type="number" step="any" value={exchangeRate} disabled={currency === "VES"} onChange={(e) => setExchangeRate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Método de pago</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.label || METHOD_LABELS[m.method_type]}</SelectItem>
                  ))}
                  {methods.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin métodos guardados</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedMethod && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-1.5">Datos para el pago</p>
              <MethodDetails method={selectedMethod} />
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Facturas de este pago</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setDocuments((p) => [...p, newDocument()])}>
                <Plus className="h-3 w-3 mr-1" />Agregar factura
              </Button>
            </div>
            {documents.map((doc) => (
              <PurchaseDocumentFields
                key={doc.key}
                document={doc}
                concepts={concepts}
                showIslr={islrEnabled}
                showVat={vatEnabled}
                withholdings={draft.withholdings.filter((w) => w.document_key === doc.key)}
                canRemove={documents.length > 1}
                onChange={(patch) => updateDocument(doc.key, patch)}
                onRemove={() => setDocuments((p) => p.filter((d) => d.key !== doc.key))}
              />
            ))}
          </div>

          <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Total facturas</span><span>{formatMoney(draft.totals.gross, currency)}</span></div>
            <div className="flex justify-between"><span>Total retenido</span><span>{formatMoney(draft.totals.deductions, currency)}</span></div>
            <div className="flex justify-between font-semibold"><span>Neto a pagar</span><span>{formatMoney(draft.totals.net, currency)}</span></div>
            {currency === "USD" && (
              <div className="flex justify-between text-xs text-muted-foreground"><span>Equivalente en VES</span><span>{formatMoney(draft.totals.netVes, "VES")}</span></div>
            )}
            {problems.map((message) => (
              <p key={message} className="flex items-center gap-1 text-xs text-destructive pt-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />{message}
              </p>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observaciones</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || registerPayment.isPending}>
            {registerPayment.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
