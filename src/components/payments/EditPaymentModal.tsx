import { useState, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Pencil, AlertTriangle, Tag, Users } from "lucide-react";
import { METHOD_TYPE_LABELS } from "@/lib/venezuelan-banks";
import { applyRateOverride } from "@/lib/exchangeRateOverride";
import { useFamilyCredits } from "@/hooks/payments/useFamilyCredits";
import { FAMILY_CREDIT_METHOD, FAMILY_CREDIT_LABEL } from "@/lib/familyCredit";
import { todayCaracasIso } from "@/lib/dateUtils";

interface PaymentMethodLine {
  id: string;
  method: string;
  currency: string;
  amount_original: string;
  exchange_rate: string;
  amount_ves: string;
  reference_code: string;
  bank_name: string;
  payment_date: string;
  details: string;
}

const today = () => todayCaracasIso();

function createMethodLine(): PaymentMethodLine {
  return { id: crypto.randomUUID(), method: "transferencia", currency: "VES", amount_original: "", exchange_rate: "1", amount_ves: "", reference_code: "", bank_name: "", payment_date: today(), details: "" };
}

const EXCHANGE_RATE_TOLERANCE_VES = 1.0;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  paymentId: string;
  schoolId: string;
  schoolYearId: string;
  onSaved?: () => void;
}

export function EditPaymentModal({ open, onOpenChange, paymentId, schoolId, schoolYearId, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const initializedRef = useRef(false);

  const [reason, setReason] = useState("");
  const [invoice, setInvoice] = useState({ name: "", rif: "", phone: "", address: "" });
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [controlNumber, setControlNumber] = useState("");
  const [observations, setObservations] = useState("");
  const [selectedConcepts, setSelectedConcepts] = useState<Record<string, string>>({});
  const [methods, setMethods] = useState<PaymentMethodLine[]>([createMethodLine()]);
  const [surplusAction, setSurplusAction] = useState<"none" | "otros" | "credit">("none");
  const [applyToBalanceId, setApplyToBalanceId] = useState<string>("");

  // Datos originales del pago a editar: registro, líneas y movimientos de crédito relacionados
  const { data: paymentData, isLoading: loadingPayment } = useQuery({
    queryKey: ["edit-payment-data", paymentId],
    queryFn: async () => {
      const { data: payment, error } = await supabase.from("payments").select("*").eq("id", paymentId).single();
      if (error) throw error;
      const { data: items } = await supabase.from("payment_items").select("*").eq("payment_id", paymentId);
      const { data: methodEntries } = await supabase.from("payment_method_entries").select("*").eq("payment_id", paymentId);
      const { data: creditRows } = await supabase.from("family_credits").select("*")
        .or(`source_payment_id.eq.${paymentId},applied_payment_id.eq.${paymentId}`);
      const { data: othersRows } = await supabase.from("payment_others").select("*").eq("payment_id", paymentId);
      return { payment, items: items || [], methodEntries: methodEntries || [], creditRows: creditRows || [], othersRows: othersRows || [] };
    },
    enabled: open && !!paymentId,
  });

  const familyId = paymentData?.payment?.family_id || null;
  const singleStudentId = !familyId ? paymentData?.payment?.student_id : null;

  // Hijos de la familia (modo familiar) o el único estudiante (pago individual)
  const { data: childrenStudents = [] } = useQuery({
    queryKey: ["edit-payment-children", familyId, singleStudentId],
    queryFn: async () => {
      if (familyId) {
        const { data } = await supabase.from("students").select("id, form_data").eq("family_id", familyId);
        return data || [];
      }
      if (singleStudentId) {
        const { data } = await supabase.from("students").select("id, form_data").eq("id", singleStudentId);
        return data || [];
      }
      return [];
    },
    enabled: open && (!!familyId || !!singleStudentId),
  });

  const childStudentIds = useMemo(() => childrenStudents.map((s: any) => s.id), [childrenStudents]);

  // Saldos vigentes de los hijos involucrados
  const { data: rawBalances = [], isFetched: balancesFetched } = useQuery({
    queryKey: ["edit-payment-balances", childStudentIds.join(","), schoolYearId, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("student_concept_balances")
        .select("*, payment_plan_concepts(amount, discount_type, discount_value, display_order, payment_concepts(name, concept_type))")
        .in("student_id", childStudentIds)
        .eq("school_year_id", schoolYearId)
        .eq("school_id", schoolId);
      return data || [];
    },
    enabled: open && childStudentIds.length > 0,
  });

  // Contribución del pago original a cada concepto, para "revertir" su efecto solo en pantalla
  const oldContributionByBalance = useMemo(() => {
    const map: Record<string, number> = {};
    (paymentData?.items || []).forEach((it: any) => {
      const bal = rawBalances.find((b: any) => b.student_id === it.student_id && b.plan_concept_id === it.plan_concept_id);
      if (bal) map[bal.id] = (map[bal.id] || 0) + Number(it.amount_ves || 0);
    });
    return map;
  }, [paymentData, rawBalances]);

  const { data: rates = [] } = useQuery({
    queryKey: ["exchange-rates", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("exchange_rates").select("*").eq("school_id", schoolId);
      return data || [];
    },
    enabled: open,
  });

  const { data: schoolMethods = [] } = useQuery({
    queryKey: ["school-payment-methods", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_payment_methods").select("*").eq("school_id", schoolId).eq("is_active", true).order("display_order");
      return data || [];
    },
    enabled: open,
  });
  const methodOptions = schoolMethods.length > 0
    ? schoolMethods.map((sm: any) => ({ value: sm.id, label: `${sm.label}`, config: sm.config, method_type: sm.method_type }))
    : Object.entries(METHOD_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v, config: {}, method_type: k }));

  const { balance: rawCreditBalance } = useFamilyCredits(familyId);
  const oldUsedCredit = useMemo(() =>
    (paymentData?.creditRows || []).filter((c: any) => c.entry_type === "debit" && c.applied_payment_id === paymentId)
      .reduce((s: number, c: any) => s + Number(c.amount_ves || 0), 0), [paymentData, paymentId]);
  // Saldo disponible "como si este pago no existiera": se le devuelve lo que este mismo pago ya consumió
  const creditBalance = rawCreditBalance + oldUsedCredit;

  const getRate = (currency: string) => {
    if (currency === "VES") return 1;
    const dbRate = rates.find((r: any) => r.currency === currency)?.rate_to_ves || 0;
    return applyRateOverride(schoolId, currency, dbRate);
  };

  const getDisplayTotal = (b: any) => b.currency === "VES" ? (b.total_amount || 0) : (b.original_amount || 0) * getRate(b.currency || "VES");
  // Balance "editable": el vigente + lo que este mismo pago ya había cubierto de ese concepto
  const getEditableBalance = (b: any) => Math.max(0, getDisplayTotal(b) - (b.paid_amount || 0)) + (oldContributionByBalance[b.id] || 0);

  const balances = rawBalances;

  // Inicializar formulario una sola vez, cuando ya están el pago y los saldos
  useEffect(() => {
    if (!open || initializedRef.current || !paymentData || !balancesFetched) return;
    const { payment, items, methodEntries, creditRows, othersRows } = paymentData;

    setInvoiceNumber(payment.invoice_number || "");
    setControlNumber(payment.control_number || "");
    setObservations(payment.observations || "");
    setInvoice({ name: payment.invoice_name || "", rif: payment.invoice_rif || "", phone: payment.invoice_phone || "", address: payment.invoice_address || "" });

    const sel: Record<string, string> = {};
    items.forEach((it: any) => {
      const bal = balances.find((b: any) => b.student_id === it.student_id && b.plan_concept_id === it.plan_concept_id);
      if (bal) sel[bal.id] = Number(it.amount_ves || 0).toFixed(2);
    });
    setSelectedConcepts(sel);

    setMethods(methodEntries.length > 0 ? methodEntries.map((m: any) => ({
      id: crypto.randomUUID(),
      method: m.method,
      currency: m.currency,
      amount_original: String(m.amount_original ?? ""),
      exchange_rate: String(m.exchange_rate ?? "1"),
      amount_ves: String(m.amount_ves ?? ""),
      reference_code: m.reference_code || "",
      bank_name: m.bank_name || "",
      payment_date: m.payment_date || today(),
      details: m.details || "",
    })) : [createMethodLine()]);

    const hadCredit = creditRows.some((c: any) => c.entry_type === "credit" && c.source_payment_id === payment.id);
    const hadOtros = othersRows.length > 0;
    setSurplusAction(hadCredit ? "credit" : hadOtros ? "otros" : "none");

    initializedRef.current = true;
  }, [open, paymentData, balances, balancesFetched]);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      setReason("");
    }
  }, [open]);

  const updateMethodField = (id: string, field: string, value: string) => {
    setMethods((prev) => prev.map((m) => {
      if (m.id !== id) return m;
      const updated = { ...m, [field]: value };
      if (["amount_original", "exchange_rate", "currency"].includes(field)) {
        const rate = field === "currency" ? getRate(value).toString() : (field === "exchange_rate" ? value : updated.exchange_rate);
        const amount = field === "amount_original" ? value : updated.amount_original;
        updated.exchange_rate = rate;
        updated.amount_ves = (parseFloat(amount || "0") * parseFloat(rate || "0")).toFixed(2);
      }
      return updated;
    }));
  };

  const addMethod = () => setMethods((p) => [...p, createMethodLine()]);
  const removeMethod = (id: string) => setMethods((p) => p.filter((m) => m.id !== id));

  const toggleConcept = (balanceId: string, maxAmount: number) => {
    setSelectedConcepts((prev) => {
      const next = { ...prev };
      if (balanceId in next) { delete next[balanceId]; } else { next[balanceId] = maxAmount.toFixed(2); }
      return next;
    });
  };

  const balancesByStudent = useMemo(() => {
    const map: Record<string, any[]> = {};
    balances.forEach((b: any) => {
      if (!map[b.student_id]) map[b.student_id] = [];
      map[b.student_id].push(b);
    });
    return map;
  }, [balances]);

  const studentName = (student: any) => [
    (student?.form_data as any)?.primer_nombre,
    (student?.form_data as any)?.segundo_nombre,
    (student?.form_data as any)?.primer_apellido,
    (student?.form_data as any)?.segundo_apellido,
  ].filter(Boolean).join(" ") || "Sin nombre";

  const totalConcepts = useMemo(() =>
    Object.values(selectedConcepts).reduce((s, v) => s + (parseFloat(v) || 0), 0), [selectedConcepts]);

  const totalMethods = useMemo(() =>
    methods.reduce((s, m) => s + (parseFloat(m.amount_ves) || 0), 0), [methods]);

  const usedCredit = useMemo(() =>
    methods.filter((m) => m.method === FAMILY_CREDIT_METHOD).reduce((s, m) => s + (parseFloat(m.amount_ves) || 0), 0), [methods]);

  const difference = totalMethods - totalConcepts;

  // Cuánto más se le puede aplicar a un balance sin pasar su disponible (ya considerando lo seleccionado)
  const remainingCapacity = (b: any) => Math.max(0, getEditableBalance(b) - (parseFloat(selectedConcepts[b.id] || "0") || 0));

  const eligibleForSurplus = useMemo(() =>
    balances.filter((b: any) => remainingCapacity(b) > 0.01), [balances, selectedConcepts]);

  const studentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    childrenStudents.forEach((s: any) => { if (s.id) map[s.id] = studentName(s); });
    return map;
  }, [childrenStudents]);

  const applySurplusToConcept = () => {
    if (!applyToBalanceId) return;
    const bal = balances.find((b: any) => b.id === applyToBalanceId);
    if (!bal) return;
    const amt = Math.min(difference, remainingCapacity(bal));
    if (amt <= 0) return;
    setSelectedConcepts((prev) => ({ ...prev, [applyToBalanceId]: ((parseFloat(prev[applyToBalanceId] || "0") || 0) + amt).toFixed(2) }));
    setApplyToBalanceId("");
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!reason.trim()) throw new Error("El motivo de la modificación es obligatorio");
      if (!invoiceNumber.trim()) throw new Error("El N° de factura es obligatorio");
      if (Object.keys(selectedConcepts).length === 0) throw new Error("Seleccione al menos un concepto");
      if (methods.length === 0) throw new Error("Agregue al menos una forma de pago");
      if (totalMethods <= 0) throw new Error("El monto total debe ser mayor a 0");
      if (Math.abs(difference) > 0.01 && difference < 0) throw new Error("El monto pagado es insuficiente para cubrir los conceptos seleccionados");
      if (usedCredit > creditBalance + 0.01) throw new Error("El saldo a favor usado supera el disponible de la familia");

      const { payment: oldPayment, items: oldItems, methodEntries: oldMethodEntries, creditRows: oldCreditRows, othersRows: oldOthersRows } = paymentData!;

      const beforeSnapshot = { payment: oldPayment, items: oldItems, methodEntries: oldMethodEntries, creditRows: oldCreditRows, othersRows: oldOthersRows };

      // 1) Revertir el efecto de las líneas viejas sobre los saldos
      for (const item of oldItems) {
        const { data: bal } = await supabase.from("student_concept_balances")
          .select("*")
          .eq("student_id", item.student_id)
          .eq("school_year_id", schoolYearId)
          .eq("school_id", schoolId)
          .eq("plan_concept_id", item.plan_concept_id)
          .maybeSingle();
        if (!bal) continue;
        const newPaid = Math.max(0, (Number(bal.paid_amount) || 0) - (Number(item.amount_ves) || 0));
        const newBalance = Math.max(0, (Number(bal.total_amount) || 0) - newPaid);
        const newStatus = newPaid <= 0 ? "pending" : (newBalance <= 0 ? "paid" : "partial");
        await supabase.from("student_concept_balances").update({
          paid_amount: newPaid,
          balance: newBalance,
          status: newStatus,
        }).eq("id", bal.id);
      }

      // 2) Borrar líneas y movimientos de crédito/otros viejos ligados a este pago
      await supabase.from("payment_items").delete().eq("payment_id", paymentId);
      await supabase.from("payment_method_entries").delete().eq("payment_id", paymentId);
      await supabase.from("family_credits").delete().or(`source_payment_id.eq.${paymentId},applied_payment_id.eq.${paymentId}`);
      await supabase.from("payment_others").delete().eq("payment_id", paymentId);

      // 3) Actualizar el registro de pago (mismo id, no se crea uno nuevo)
      const { error: payErr } = await supabase.from("payments").update({
        payment_date: methods[0]?.payment_date || oldPayment.payment_date,
        total_amount_ves: totalMethods,
        observations: observations || null,
        invoice_number: invoiceNumber.trim(),
        control_number: controlNumber.trim(),
        invoice_name: invoice.name || null,
        invoice_rif: invoice.rif || null,
        invoice_phone: invoice.phone || null,
        invoice_address: invoice.address || null,
        updated_at: new Date().toISOString(),
      }).eq("id", paymentId);
      if (payErr) throw payErr;

      // 4) Insertar líneas nuevas
      const newItems = Object.entries(selectedConcepts).map(([balanceId, amountStr]) => {
        const bal = balances.find((b: any) => b.id === balanceId);
        const amount = parseFloat(amountStr) || 0;
        return {
          payment_id: paymentId,
          plan_concept_id: bal!.plan_concept_id,
          student_id: bal!.student_id,
          amount_ves: amount,
          is_partial: amount < getEditableBalance(bal!) - 0.01,
        };
      });
      const { error: itemErr } = await supabase.from("payment_items").insert(newItems as any);
      if (itemErr) throw itemErr;

      const newMethodEntries = methods.filter((m) => parseFloat(m.amount_original) > 0).map((m) => ({
        payment_id: paymentId,
        method: m.method,
        currency: m.currency,
        amount_original: parseFloat(m.amount_original) || 0,
        exchange_rate: parseFloat(m.exchange_rate) || 1,
        amount_ves: parseFloat(m.amount_ves) || 0,
        reference_code: m.reference_code || null,
        bank_name: m.bank_name || null,
        payment_date: m.payment_date || today(),
        details: m.details || null,
      }));
      if (newMethodEntries.length > 0) {
        const { error: methErr } = await supabase.from("payment_method_entries").insert(newMethodEntries);
        if (methErr) throw methErr;
      }

      // 5) Reaplicar el efecto de las líneas nuevas sobre los saldos
      for (const [balanceId, amountStr] of Object.entries(selectedConcepts)) {
        const amount = parseFloat(amountStr) || 0;
        const bal = balances.find((b: any) => b.id === balanceId);
        if (!bal) continue;
        const { data: freshBal } = await supabase.from("student_concept_balances").select("*").eq("id", balanceId).single();
        if (!freshBal) continue;
        const currentRate = getRate(bal.currency || "VES");
        const newTotalAmount = getDisplayTotal(bal);
        const newPaid = parseFloat(((Number(freshBal.paid_amount) || 0) + amount).toFixed(2));
        const newBalance = parseFloat((newTotalAmount - newPaid).toFixed(2));
        const effectiveBalance = newBalance > 0 && newBalance <= EXCHANGE_RATE_TOLERANCE_VES ? 0 : Math.max(0, newBalance);
        const newStatus = effectiveBalance <= 0 ? "paid" : "partial";
        await supabase.from("student_concept_balances").update({
          exchange_rate_snapshot: currentRate,
          total_amount: newTotalAmount,
          paid_amount: effectiveBalance <= 0 ? newTotalAmount : newPaid,
          balance: effectiveBalance,
          status: newStatus,
          last_payment_date: today(),
        }).eq("id", balanceId);
      }

      // 6) Reinsertar sobrante como Otros o saldo a favor, y el saldo a favor consumido
      if (surplusAction === "otros" && difference > 0.01) {
        await supabase.from("payment_others").insert({
          payment_id: paymentId,
          school_id: schoolId,
          amount_ves: parseFloat(difference.toFixed(2)),
          invoice_number: invoiceNumber.trim() || null,
          created_by: user!.id,
        });
      }
      if (surplusAction === "credit" && difference > 0.01 && familyId) {
        await supabase.from("family_credits").insert({
          school_id: schoolId,
          family_id: familyId,
          entry_type: "credit",
          amount_ves: parseFloat(difference.toFixed(2)),
          source_payment_id: paymentId,
          note: observations || `Sobrante de factura ${invoiceNumber.trim()}`,
          created_by: user!.id,
        });
      }
      if (usedCredit > 0.01 && familyId) {
        await supabase.from("family_credits").insert({
          school_id: schoolId,
          family_id: familyId,
          entry_type: "debit",
          amount_ves: parseFloat(usedCredit.toFixed(2)),
          applied_payment_id: paymentId,
          note: `Aplicado a factura ${invoiceNumber.trim()}`,
          created_by: user!.id,
        });
      }

      // 7) Auditoría: snapshot antes/después + motivo
      const { data: afterPayment } = await supabase.from("payments").select("*").eq("id", paymentId).single();
      const afterSnapshot = {
        payment: afterPayment,
        items: newItems,
        methodEntries: newMethodEntries,
        surplusAction,
        usedCredit,
      };
      await supabase.from("payment_edit_log").insert({
        payment_id: paymentId,
        school_id: schoolId,
        edited_by: user!.id,
        reason: reason.trim(),
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
      } as any);

      return paymentId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-payment-history"] });
      qc.invalidateQueries({ queryKey: ["family-students-balances"] });
      qc.invalidateQueries({ queryKey: ["family-credits"] });
      qc.invalidateQueries({ queryKey: ["families-payment-registration"] });
      qc.invalidateQueries({ queryKey: ["all-student-balances"] });
      qc.invalidateQueries({ queryKey: ["student-balances"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["recent-payments"] });
      qc.invalidateQueries({ queryKey: ["all-completed-payments-stats"] });
      toast({ title: "Pago modificado", description: "Los saldos fueron recalculados con los nuevos datos." });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error al modificar", description: e.message, variant: "destructive" }),
  });

  const childrenRows = childrenStudents.map((s: any) => ({ student: s }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[70vw] max-w-[70vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5" />Editar Pago</DialogTitle></DialogHeader>

        {loadingPayment || !paymentData ? (
          <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>
        ) : (
          <div className="space-y-6">
            <Alert className="border-yellow-300 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                Estás modificando un pago ya registrado. Al guardar, se recalculan los saldos de los conceptos afectados con los nuevos valores.
              </AlertDescription>
            </Alert>

            <div className="space-y-1">
              <Label className="text-xs">Motivo de la modificación <span className="text-destructive">*</span></Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Explica por qué se corrige este pago (obligatorio, queda registrado en la auditoría)..." />
            </div>

            <Card>
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">N° de Factura <span className="text-destructive">*</span></Label>
                    <Input className="h-8 text-sm" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N° de Control</Label>
                    <Input className="h-8 text-sm" value={controlNumber} onChange={(e) => setControlNumber(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3"><CardTitle className="text-sm">Datos de Factura</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1"><Label className="text-xs">RIF / Cédula</Label><Input className="h-8 text-sm" value={invoice.rif} onChange={(e) => setInvoice({ ...invoice, rif: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Nombre / Razón Social</Label><Input className="h-8 text-sm" value={invoice.name} onChange={(e) => setInvoice({ ...invoice, name: e.target.value })} /></div>
                  <div className="space-y-1"><Label className="text-xs">Teléfono</Label><Input className="h-8 text-sm" value={invoice.phone} onChange={(e) => setInvoice({ ...invoice, phone: e.target.value })} /></div>
                  <div className="space-y-1 md:col-span-3"><Label className="text-xs">Dirección</Label><Input className="h-8 text-sm" value={invoice.address} onChange={(e) => setInvoice({ ...invoice, address: e.target.value })} /></div>
                </div>
              </CardContent>
            </Card>

            {/* Concepts grouped by child */}
            <Card>
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Conceptos</CardTitle>
                <Badge variant="outline">Total: {totalConcepts.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</Badge>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pagado</TableHead>
                      <TableHead>Disponible</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Monto a pagar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {childrenRows.map((child: any) => {
                      const sid = child.student?.id;
                      const childBalances = (balancesByStudent[sid] || []).filter((b: any) => getEditableBalance(b) > 0);
                      return [
                        familyId && (
                          <TableRow key={`header-${sid}`} className="bg-muted/40 hover:bg-muted/40">
                            <TableCell></TableCell>
                            <TableCell colSpan={6}>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{studentName(child.student)}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ),
                        ...(childBalances.length === 0 ? [
                          <TableRow key={`empty-${sid}`}>
                            <TableCell></TableCell>
                            <TableCell colSpan={6} className="text-xs text-muted-foreground py-2">Sin conceptos disponibles para este estudiante.</TableCell>
                          </TableRow>,
                        ] : childBalances.map((b: any) => {
                          const conceptName = (b.payment_plan_concepts as any)?.payment_concepts?.name || "—";
                          const cur = b.currency || "VES";
                          const isSelected = b.id in selectedConcepts;
                          const displayTotal = getDisplayTotal(b);
                          const editableBalance = getEditableBalance(b);
                          return (
                            <TableRow key={b.id} className={isSelected ? "bg-primary/5" : ""}>
                              <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleConcept(b.id, editableBalance)} /></TableCell>
                              <TableCell className="font-medium">
                                {conceptName}
                                {cur !== "VES" && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ({Number(b.original_amount || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {cur} @ {Number(getRate(cur)).toLocaleString("es-VE", { minimumFractionDigits: 2 })})
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>{displayTotal.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>{b.paid_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell className="font-medium">{editableBalance.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                              <TableCell>
                                <Badge variant={b.status === "paid" ? "default" : b.status === "partial" ? "secondary" : "outline"}>
                                  {b.status === "paid" ? "Pagado" : b.status === "partial" ? "Parcial" : "Pendiente"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isSelected && (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-7 w-28 text-xs"
                                    value={selectedConcepts[b.id]}
                                    onChange={(e) => {
                                      const val = Math.min(parseFloat(e.target.value) || 0, editableBalance);
                                      setSelectedConcepts((p) => ({ ...p, [b.id]: val.toFixed(2) }));
                                    }}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })),
                      ];
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader className="py-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm">Formas de Pago</CardTitle>
                  {familyId && creditBalance > 0.01 && (
                    <Badge variant="outline" className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                      <Tag className="h-3 w-3" />
                      Saldo a favor disponible: {creditBalance.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
                    </Badge>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={addMethod}><Plus className="h-3 w-3 mr-1" />Agregar</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {methods.map((m, idx) => {
                  const isCreditLine = m.method === FAMILY_CREDIT_METHOD;
                  const otherCreditUsed = usedCredit - (parseFloat(m.amount_ves) || 0);
                  const creditRemaining = Math.max(0, creditBalance - otherCreditUsed);
                  return (
                    <div key={m.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-muted-foreground">Pago #{idx + 1}</span>
                        {methods.length > 1 && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeMethod(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Método</Label>
                          <Select value={m.method} onValueChange={(v) => {
                            updateMethodField(m.id, "method", v);
                            if (v === FAMILY_CREDIT_METHOD) {
                              updateMethodField(m.id, "currency", "VES");
                              updateMethodField(m.id, "exchange_rate", "1");
                            }
                          }}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {methodOptions.map((mt) => <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>)}
                              {familyId && creditBalance > 0.01 && <SelectItem value={FAMILY_CREDIT_METHOD}>{FAMILY_CREDIT_LABEL}</SelectItem>}
                            </SelectContent>
                          </Select>
                          {isCreditLine && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">Disponible: {creditRemaining.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p>
                          )}
                        </div>
                        {!isCreditLine && (
                          <div className="space-y-1">
                            <Label className="text-xs">Moneda</Label>
                            <Select value={m.currency} onValueChange={(v) => {
                              updateMethodField(m.id, "currency", v);
                              const rate = getRate(v);
                              updateMethodField(m.id, "exchange_rate", rate.toString());
                            }}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="VES">VES</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="COP">COP</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">Monto ({m.currency})</Label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-xs"
                            value={m.amount_original}
                            onChange={(e) => {
                              const raw = parseFloat(e.target.value) || 0;
                              const val = isCreditLine ? Math.min(raw, creditRemaining) : raw;
                              updateMethodField(m.id, "amount_original", val.toString());
                            }}
                          />
                        </div>
                        {!isCreditLine && m.currency !== "VES" && (
                          <div className="space-y-1"><Label className="text-xs">Tasa</Label><Input type="number" step="0.01" className="h-8 text-xs" value={m.exchange_rate} onChange={(e) => updateMethodField(m.id, "exchange_rate", e.target.value)} /></div>
                        )}
                        <div className="space-y-1"><Label className="text-xs">= VES</Label><Input className="h-8 text-xs bg-muted" value={parseFloat(m.amount_ves || "0").toLocaleString("es-VE", { minimumFractionDigits: 2 })} readOnly /></div>
                        {!isCreditLine && <>
                          <div className="space-y-1"><Label className="text-xs">Referencia</Label><Input className="h-8 text-xs" value={m.reference_code} onChange={(e) => updateMethodField(m.id, "reference_code", e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Banco</Label><Input className="h-8 text-xs" value={m.bank_name} onChange={(e) => updateMethodField(m.id, "bank_name", e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" className="h-8 text-xs" value={m.payment_date} onChange={(e) => updateMethodField(m.id, "payment_date", e.target.value)} /></div>
                        </>}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} placeholder="Notas adicionales..." />
            </div>

            <Card className={difference < -0.01 ? "border-destructive" : (difference > 0.01 && surplusAction === "none") ? "border-yellow-500" : "border-green-500"}>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Total Conceptos:</span><p className="text-lg font-bold">{totalConcepts.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></div>
                  <div><span className="text-muted-foreground">Total Pagado:</span><p className="text-lg font-bold">{totalMethods.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></div>
                  <div>
                    <span className="text-muted-foreground">Diferencia:</span>
                    <p className={`text-lg font-bold ${Math.abs(difference) < 0.01 ? "text-green-600" : difference > 0 ? (surplusAction !== "none" ? "text-green-600" : "text-blue-600") : "text-destructive"}`}>
                      {difference > 0 ? "+" : ""}{difference.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
                      {difference > 0.01 && surplusAction === "otros" && " → Otros"}
                      {difference > 0.01 && surplusAction === "credit" && " → Saldo a favor"}
                      {difference > 0.01 && surplusAction === "none" && " (Sobrepago)"}
                      {difference < -0.01 && " (Insuficiente)"}
                    </p>
                  </div>
                </div>
                {difference > 0.01 && (
                  <div className="border-t pt-2 space-y-2">
                    {surplusAction === "none" ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-yellow-600">
                          <AlertTriangle className="h-4 w-4" />
                          Existe un sobrepago de {difference.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES.
                        </div>
                        {eligibleForSurplus.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select value={applyToBalanceId} onValueChange={setApplyToBalanceId}>
                              <SelectTrigger className="h-7 text-xs w-64"><SelectValue placeholder="Aplicar a una cuota específica..." /></SelectTrigger>
                              <SelectContent>
                                {eligibleForSurplus.map((b: any) => {
                                  const label = (b.payment_plan_concepts as any)?.payment_concepts?.name || "Concepto";
                                  const cap = remainingCapacity(b);
                                  return (
                                    <SelectItem key={b.id} value={b.id}>
                                      {studentNameById[b.student_id] ? `${studentNameById[b.student_id]} — ` : ""}{label} (disp. {cap.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES)
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!applyToBalanceId} onClick={applySurplusToConcept}>
                              Aplicar a la cuota
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {familyId && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSurplusAction("credit")}>
                              + Guardar como saldo a favor
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSurplusAction("otros")}>
                            + Agregar a Otros
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-green-600">
                          <span className="font-medium">{difference.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</span> se registrarán {surplusAction === "credit" ? "como " : "en "}
                          <span className="font-medium">{surplusAction === "credit" ? "saldo a favor de la familia" : "Otros"}</span> al guardar.
                        </div>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => setSurplusAction("none")}>
                          Quitar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                {difference < -0.01 && (
                  <div className="flex items-center gap-2 text-xs text-destructive"><AlertTriangle className="h-4 w-4" />El monto pagado no cubre el total seleccionado.</div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !reason.trim() || Object.keys(selectedConcepts).length === 0}>
                {saveMut.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
                Guardar Cambios
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
