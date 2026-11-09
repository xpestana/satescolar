import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePayrollConcepts } from "@/hooks/payroll/usePayrollConcepts";
import { usePayrollMethods } from "@/hooks/payroll/usePayrollMethods";
import { usePayrollUsdRate } from "@/hooks/payroll/usePayrollUsdRate";
import { usePayrollPayments } from "@/hooks/payroll/usePayrollPayments";
import { usePayrollTaxConfig } from "@/hooks/payroll/usePayrollTaxConfig";
import { usePayrollAriRates } from "@/hooks/payroll/usePayrollAriRates";
import { usePayrollPeriods } from "@/hooks/payroll/usePayrollPeriods";
import { usePayrollContributionConfig } from "@/hooks/payroll/usePayrollContributionConfig";
import { usePayrollMonthPayments } from "@/hooks/payroll/usePayrollMonthPayments";
import { lineFlags, splitMonthPayments } from "@/lib/payroll/contributions/monthBase";
import { usePayrollBeneficiaryConcepts } from "@/hooks/payroll/usePayrollBeneficiaryConcepts";
import { amountInPaymentCurrency, defaultConceptLines, sharedCurrency } from "@/lib/payroll/defaultConcepts";
import { deductionsExceedEarnings, round2 } from "@/lib/payroll/calculateNet";
import { formatMoney } from "@/lib/payroll/buildPayrollReceiptData";
import { METHOD_LABELS, type ConceptKind, type PayrollCategory, type PayrollCurrency } from "@/lib/payroll/types";
import { buildSalaryPaymentDraft, type MonthBaseSummary } from "@/lib/payroll/withholdings/buildPaymentDraft";
import { todayCaracasIso } from "@/lib/dateUtils";
import { MethodDetails } from "@/components/payroll/MethodDetails";

interface PayrollPaymentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schoolId: string;
  periodId: string;
  beneficiary: { id: string; full_name: string; monthly_hours?: number | null; category?: PayrollCategory };
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
  const { concepts, isLoading: conceptsLoading } = usePayrollConcepts(schoolId);
  const { own, isFetched: ownFetched } = usePayrollBeneficiaryConcepts(schoolId, beneficiary.id);
  const { methods } = usePayrollMethods(schoolId, beneficiary.id);
  const { data: usdRate = 0 } = usePayrollUsdRate(schoolId);
  const { registerPayment } = usePayrollPayments(schoolId);
  const { islrEnabled, vatEnabled, parameters } = usePayrollTaxConfig(schoolId);
  const { ratesByBeneficiary } = usePayrollAriRates(schoolId);
  const { periods } = usePayrollPeriods(schoolId);
  const { enabled: contributionsEnabled, parameters: contributionParameters } = usePayrollContributionConfig(schoolId);
  const period = periods.find((p) => p.id === periodId);
  const applyDeductions = period?.apply_deductions ?? true;
  const monthQuery = usePayrollMonthPayments(beneficiary.id, period?.end_date, open);
  const month = useMemo(
    () => splitMonthPayments(monthQuery.data ?? [], period?.end_date ?? "", concepts),
    [monthQuery.data, period?.end_date, concepts]
  );

  const [currency, setCurrency] = useState<PayrollCurrency>("VES");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [methodId, setMethodId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [unpaidHours, setUnpaidHours] = useState("");
  const [lines, setLines] = useState<EditableLine[]>([newLine()]);
  const [prefilledCount, setPrefilledCount] = useState(0);
  const prefilled = useRef(false);

  const selectedMethod = methods.find((m) => m.id === methodId);

  useEffect(() => {
    if (!open) return;
    setCurrency("VES");
    setExchangeRate("1");
    setMethodId("");
    setNotes("");
    setUnpaidHours("");
    setLines([newLine()]);
    setPrefilledCount(0);
    prefilled.current = false;
  }, [open]);

  // Once its data is loaded, fill in the concepts this worker usually gets, in the currency they
  // share (so a salary in dollars opens the payment in dollars).
  useEffect(() => {
    if (!open || prefilled.current || conceptsLoading || !ownFetched) return;
    prefilled.current = true;
    const defaults = defaultConceptLines(concepts, beneficiary.category ?? "other", own);
    if (defaults.length === 0) return;
    const paymentCurrency = sharedCurrency(defaults) ?? "VES";
    setCurrency(paymentCurrency);
    setLines(
      defaults.map(({ concept, amount }) => {
        const converted = amountInPaymentCurrency(amount, concept.currency, paymentCurrency, usdRate);
        return {
          ...newLine(),
          concept_id: concept.id,
          description: concept.name,
          concept_kind: concept.concept_kind,
          amount: converted ? String(converted) : "",
        };
      })
    );
    setPrefilledCount(defaults.length);
  }, [open, conceptsLoading, ownFetched, concepts, own, beneficiary.category, usdRate]);

  // When switching to USD, prefill the current rate.
  useEffect(() => {
    if (currency === "USD") setExchangeRate(usdRate > 0 ? String(usdRate) : "0");
    else setExchangeRate("1");
  }, [currency, usdRate]);

  const rate = Number(exchangeRate) || 0;

  // Typed lines + the automatic AR-I and contribution lines. In a discounting period they cover
  // the whole month, adding the worker's earlier payments of the month.
  const draft = useMemo(
    () =>
      buildSalaryPaymentDraft({
        vatEnabled,
        islrEnabled,
        date: todayCaracasIso(),
        parameters,
        currency,
        exchangeRate: rate,
        ariRates: ratesByBeneficiary[beneficiary.id] ?? [],
        applyDeductions,
        monthDate: period?.end_date,
        priorPayments: month.prior,
        contributionsEnabled,
        contributionParameters,
        unpaidHours: Number(unpaidHours) || 0,
        monthlyHours: beneficiary.monthly_hours ?? null,
        lines: lines
          .filter((l) => l.amount !== "" && Number(l.amount) > 0)
          .map((l) => ({
            concept_id: l.concept_id,
            description: l.description,
            concept_kind: l.concept_kind,
            amount: Number(l.amount),
            ...lineFlags(l.concept_id, concepts),
          })),
      }),
    [
      lines, concepts, vatEnabled, islrEnabled, parameters, currency, rate, ratesByBeneficiary, beneficiary.id,
      applyDeductions, period?.end_date, month.prior, contributionsEnabled, contributionParameters,
      unpaidHours, beneficiary.monthly_hours,
    ]
  );

  const items = draft.items;
  const totals = draft.totals;
  const netVes = totals.netVes;
  const invalidDeductions = deductionsExceedEarnings(items);
  const automaticLines = items.filter((i) => i.withholding_key || i.contribution_key || i.unpaid_hours);
  const monthLoading = !period || monthQuery.isLoading;

  const updateLine = (key: string, patch: Partial<EditableLine>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const onPickConcept = (key: string, conceptId: string) => {
    const c = concepts.find((x) => x.id === conceptId);
    if (!c) return;
    // A concept priced in the other currency is converted at the dollar rate: the one typed in a
    // payment in dollars, the school's current one in a payment in bolívares (whose rate field is 1).
    let amount = c.default_amount || 0;
    if (amount && c.currency !== currency) {
      const usdToVes = currency === "USD" ? rate : usdRate;
      amount = usdToVes > 0 ? round2(c.currency === "USD" ? amount * usdToVes : amount / usdToVes) : 0;
    }
    updateLine(key, {
      concept_id: c.id,
      description: c.name,
      concept_kind: c.concept_kind,
      amount: amount ? String(amount) : "",
    });
  };

  const canSubmit =
    items.length > 0 &&
    totals.net > 0 &&
    !invalidDeductions &&
    draft.errors.length === 0 &&
    !monthLoading &&
    !monthQuery.isError &&
    (currency === "VES" || rate > 0);

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
        withholdings: draft.withholdings,
        contributions: draft.contributions,
        month_base_payment_ids: draft.monthBasePaymentIds,
      },
      {
        onSuccess: () => {
          toast({ title: "Pago registrado en borrador", description: "Queda pendiente de aprobación." });
          onOpenChange(false);
        },
        onError: (e: Error) => {
          // Another payment of the month changed meanwhile: reload them so the bases are current.
          monthQuery.refetch();
          toast({ title: "Error", description: e.message, variant: "destructive" });
        },
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
                step="any"
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
            {prefilledCount > 0 && (
              <p className="text-xs text-muted-foreground">
                Salieron puestos los conceptos de este trabajador. Revise los montos y quite o agregue líneas si hace falta.
              </p>
            )}
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

          <MonthNotes
            applyDeductions={applyDeductions}
            periodName={period?.name}
            monthBase={draft.monthBase}
            laterDiscounting={month.laterDiscounting}
          />

          {/* Totals */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Total asignaciones</span><span>{formatMoney(totals.gross, currency)}</span></div>
            {automaticLines.map((line) => (
              <div key={line.withholding_key ?? line.contribution_key ?? "unpaid"} className="flex justify-between text-xs text-muted-foreground">
                <span>{line.description} (automática)</span>
                <span className="text-right">
                  {currency === "VES"
                    ? formatMoney(line.amount, currency)
                    : `${formatMoney(line.amount, currency)} · ${formatMoney(line.amount_ves ?? 0, "VES")}`}
                </span>
              </div>
            ))}
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
            {monthQuery.isError && (
              <p className="flex items-center gap-1 text-xs text-destructive pt-1">
                <AlertTriangle className="h-3 w-3" />No se pudieron leer los pagos de este mes del trabajador.
              </p>
            )}
            {draft.errors.map((message) => (
              <p key={message} className="flex items-center gap-1 text-xs text-destructive pt-1">
                <AlertTriangle className="h-3 w-3" />{message}
              </p>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="unpaid-hours" className="text-xs">Horas no trabajadas (permiso no justificado)</Label>
            <Input
              id="unpaid-hours"
              type="number"
              min="0"
              step="any"
              className="w-40"
              value={unpaidHours}
              onChange={(e) => setUnpaidHours(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              {beneficiary.monthly_hours
                ? `Trabaja ${beneficiary.monthly_hours} h al mes.` +
                  (draft.hourlyVes ? ` Valor de la hora: ${formatMoney(draft.hourlyVes, "VES")} (sueldo base ÷ horas al mes).` : "")
                : "Para descontar horas, indique en su ficha cuántas horas trabaja al mes."}
            </p>
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

interface MonthNotesProps {
  applyDeductions: boolean;
  periodName?: string;
  monthBase: MonthBaseSummary | null;
  laterDiscounting: { id: string; label: string; status: string }[];
}

/** Explains what this period discounts and which payments of the month it adds up. */
function MonthNotes({ applyDeductions, periodName, monthBase, laterDiscounting }: MonthNotesProps) {
  const prior = monthBase?.prior ?? [];
  return (
    <>
      {!applyDeductions && (
        <div className="flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <Info className="h-4 w-4 shrink-0" />
          <p>
            {periodName ? `"${periodName}"` : "Este período"} no descuenta retenciones ni parafiscales: se paga completo.
            Se descontarán en el período del mes que sí descuenta, sumando este pago.
          </p>
        </div>
      )}
      {applyDeductions && prior.length > 0 && monthBase && (
        <div className="rounded-md border p-3 text-xs space-y-1">
          <p className="font-medium">Base del mes</p>
          {prior.map((p) => (
            <div key={p.id} className="flex justify-between gap-3 text-muted-foreground">
              <span className="truncate">{p.label}{p.applyDeductions ? " (ya descontó)" : ""}</span>
              <span>{formatMoney(p.contributionBaseVes, "VES")}</span>
            </div>
          ))}
          <div className="flex justify-between gap-3 text-muted-foreground">
            <span>Este pago</span>
            <span>{formatMoney(monthBase.ownContributionVes, "VES")}</span>
          </div>
          <div className="flex justify-between gap-3 font-medium border-t pt-1">
            <span>Total del mes</span>
            <span>{formatMoney(monthBase.contributionBaseVes, "VES")}</span>
          </div>
          {monthBase.islrBaseVes !== monthBase.contributionBaseVes && (
            <p className="text-muted-foreground">Base del AR-I: {formatMoney(monthBase.islrBaseVes, "VES")}.</p>
          )}
        </div>
      )}
      {laterDiscounting.map((p) => (
        <p key={p.id} className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          {p.status === "paid"
            ? `"${p.label}" ya está pagado y se calculó sin este pago, así que este monto no entrará en sus retenciones del mes.`
            : `"${p.label}" se calculó sin este pago. Al pagarlo se pedirá recalcularlo para sumar este monto.`}
        </p>
      ))}
    </>
  );
}
