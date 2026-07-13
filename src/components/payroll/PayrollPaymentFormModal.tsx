import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollConcepts } from "@/hooks/payroll/usePayrollConcepts";
import { usePayrollMethods } from "@/hooks/payroll/usePayrollMethods";
import { usePayrollUsdRate } from "@/hooks/payroll/usePayrollUsdRate";
import { usePayrollPayments } from "@/hooks/payroll/usePayrollPayments";
import { calculatePayrollTotals, convertToVes, deductionsExceedEarnings } from "@/lib/payroll/calculateNet";
import { formatMoney } from "@/lib/payroll/buildPayrollReceiptData";
import { METHOD_LABELS, type ConceptKind, type PayrollCurrency } from "@/lib/payroll/types";
import { MethodDetails } from "@/components/payroll/MethodDetails";

interface PayrollPaymentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  periodId: string;
  beneficiary: { id: string; full_name: string };
}

interface EditableLine {
  key: string;
  concept_id: string | null;
  description: string;
  concept_kind: ConceptKind;
  amount: string;
}

let lineCounter = 0;
const newLine = (): EditableLine => ({
  key: `l${lineCounter++}`,
  concept_id: null,
  description: "",
  concept_kind: "earning",
  amount: "",
});

export function PayrollPaymentFormModal({
  open,
  onOpenChange,
  schoolId,
  periodId,
  beneficiary,
}: PayrollPaymentFormModalProps) {
  const { toast } = useToast();
  const { concepts } = usePayrollConcepts(schoolId);
  const { methods } = usePayrollMethods(schoolId, beneficiary.id);
  const { data: usdRate = 0 } = usePayrollUsdRate(schoolId);
  const { registerPayment } = usePayrollPayments(schoolId);

  const [currency, setCurrency] = useState<PayrollCurrency>("VES");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [methodId, setMethodId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([newLine()]);

  const selectedMethod = methods.find((m) => m.id === methodId);

  useEffect(() => {
    if (!open) return;
    setCurrency("VES");
    setExchangeRate("1");
    setMethodId("");
    setNotes("");
    setLines([newLine()]);
  }, [open]);

  // When switching to USD, prefill the current rate.
  useEffect(() => {
    if (currency === "USD") setExchangeRate(usdRate > 0 ? String(usdRate) : "0");
    else setExchangeRate("1");
  }, [currency, usdRate]);

  const items = useMemo(
    () =>
      lines
        .filter((l) => l.amount !== "" && Number(l.amount) > 0)
        .map((l) => ({
          concept_id: l.concept_id,
          description: l.description,
          concept_kind: l.concept_kind,
          amount: Number(l.amount),
        })),
    [lines]
  );

  const totals = calculatePayrollTotals(items);
  const rate = Number(exchangeRate) || 0;
  const netVes = convertToVes(totals.net, currency, rate);
  const invalidDeductions = deductionsExceedEarnings(items);

  const updateLine = (key: string, patch: Partial<EditableLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const onPickConcept = (key: string, conceptId: string) => {
    const c = concepts.find((x) => x.id === conceptId);
    if (!c) return;
    updateLine(key, {
      concept_id: c.id,
      description: c.name,
      concept_kind: c.concept_kind,
      amount: c.default_amount ? String(c.default_amount) : "",
    });
  };

  const canSubmit =
    items.length > 0 && totals.net > 0 && !invalidDeductions && (currency === "VES" || rate > 0);

  const handleSubmit = () => {
    if (!canSubmit) {
      toast({ title: "Revise los montos del pago", variant: "destructive" });
      return;
    }
    registerPayment.mutate(
      {
        period_id: periodId,
        beneficiary_id: beneficiary.id,
        currency,
        exchange_rate: rate,
        payment_method_id: methodId || null,
        notes: notes.trim() || null,
        items,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="truncate">Registrar Pago — {beneficiary.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1 min-w-0">
          {/* Currency + rate + method */}
          <div className="grid grid-cols-3 gap-3">
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
              <Input
                type="number"
                step="0.01"
                value={exchangeRate}
                disabled={currency === "VES"}
                onChange={(e) => setExchangeRate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Método de pago</Label>
              <Select value={methodId} onValueChange={setMethodId}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {methods.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label || METHOD_LABELS[m.method_type]}
                    </SelectItem>
                  ))}
                  {methods.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin métodos guardados</div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected method details — one datum per line, each copyable */}
          {selectedMethod && (
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium mb-1.5">Datos para el pago</p>
              <MethodDetails method={selectedMethod} />
            </div>
          )}

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conceptos</Label>
              <Button size="sm" variant="outline" onClick={() => setLines((p) => [...p, newLine()])}>
                <Plus className="h-3 w-3 mr-1" />Agregar línea
              </Button>
            </div>
            {lines.map((l) => (
              <div key={l.key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4 space-y-1">
                  {concepts.length > 0 && (
                    <Select value={l.concept_id ?? ""} onValueChange={(v) => onPickConcept(l.key, v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Concepto..." /></SelectTrigger>
                      <SelectContent>
                        {concepts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.concept_kind === "deduction" ? "Deducción" : "Asignación"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    className="h-8 text-xs"
                    placeholder="Descripción"
                    value={l.description}
                    onChange={(e) => updateLine(l.key, { description: e.target.value })}
                  />
                </div>
                <div className="col-span-3">
                  <Select value={l.concept_kind} onValueChange={(v) => updateLine(l.key, { concept_kind: v as ConceptKind })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earning">Asignación</SelectItem>
                      <SelectItem value="deduction">Deducción</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4">
                  <Input
                    className="h-8 text-xs"
                    type="number"
                    step="0.01"
                    placeholder="Monto"
                    value={l.amount}
                    onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                  />
                </div>
                <div className="col-span-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setLines((p) => (p.length > 1 ? p.filter((x) => x.key !== l.key) : p))}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Total asignaciones</span><span>{formatMoney(totals.gross, currency)}</span></div>
            <div className="flex justify-between"><span>Total deducciones</span><span>{formatMoney(totals.deductions, currency)}</span></div>
            <div className="flex justify-between font-semibold"><span>Neto a pagar</span><span>{formatMoney(totals.net, currency)}</span></div>
            {currency === "USD" && (
              <div className="flex justify-between text-xs text-muted-foreground"><span>Equivalente en VES</span><span>{formatMoney(netVes, "VES")}</span></div>
            )}
            {invalidDeductions && (
              <p className="flex items-center gap-1 text-xs text-destructive pt-1">
                <AlertTriangle className="h-3 w-3" />Las deducciones no pueden superar las asignaciones.
              </p>
            )}
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
