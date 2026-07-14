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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, Receipt, AlertTriangle, CheckCheck, Pencil, Tag } from "lucide-react";
import { formatGradeLevel } from "@/lib/utils";
import { todayCaracasIso } from "@/lib/dateUtils";
import { applyRateOverride } from "@/lib/exchangeRateOverride";

interface InvoiceProfile {
  id: string;
  name: string;
  rif: string;
  phone: string;
  address: string;
}

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

import { METHOD_TYPE_LABELS } from "@/lib/venezuelan-banks";
import { useFamilyCredits } from "@/hooks/payments/useFamilyCredits";
import { FAMILY_CREDIT_METHOD, FAMILY_CREDIT_LABEL } from "@/lib/familyCredit";

const today = () => todayCaracasIso();

function createMethodLine(): PaymentMethodLine {
  return { id: crypto.randomUUID(), method: "transferencia", currency: "VES", amount_original: "", exchange_rate: "1", amount_ves: "", reference_code: "", bank_name: "", payment_date: today(), details: "" };
}

const EXCHANGE_RATE_TOLERANCE_VES = 1.0;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: any;
  enrollment: any;
  schoolId: string;
  schoolYearId: string;
  initialStudentPlan?: any;
  fromReport?: any;
  onSaved?: (paymentId: string) => void;
}

export function PaymentFormModal({ open, onOpenChange, student, enrollment, schoolId, schoolYearId, initialStudentPlan, fromReport, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Invoice data
  const [invoice, setInvoice] = useState({ name: "", rif: "", phone: "", address: "" });
  const [invoiceReady, setInvoiceReady] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [surplusAction, setSurplusAction] = useState<"none" | "otros" | "credit">("none");
  const invoiceInitializedRef = useRef(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [controlNumber, setControlNumber] = useState("");
  const [observations, setObservations] = useState("");
  const [selectedConcepts, setSelectedConcepts] = useState<Record<string, string>>({});
  const [applyToBalanceId, setApplyToBalanceId] = useState<string>("");
  const autoSelectedRef = useRef(false);
  const [methods, setMethods] = useState<PaymentMethodLine[]>([createMethodLine()]);

  // Load school payment methods
  const { data: schoolMethods = [] } = useQuery({
    queryKey: ["school-payment-methods", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_payment_methods").select("*").eq("school_id", schoolId).eq("is_active", true).order("display_order");
      return data || [];
    },
    enabled: open,
  });

  // Build method options from school config, fallback to METHOD_TYPE_LABELS if none configured
  const methodOptions = schoolMethods.length > 0
    ? schoolMethods.map((sm: any) => ({ value: sm.id, label: `${sm.label}`, config: sm.config, method_type: sm.method_type }))
    : Object.entries(METHOD_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v, config: {}, method_type: k }));

  // Family credit ("saldo a favor") balance and consumption
  const { balance: creditBalance } = useFamilyCredits(student?.family_id);

  // Load rates
  const { data: rates = [] } = useQuery({
    queryKey: ["exchange-rates", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("exchange_rates").select("*").eq("school_id", schoolId);
      return data || [];
    },
    enabled: open,
  });

  // Load student plan + balances
  const { data: studentPlan } = useQuery({
    queryKey: ["student-payment-plan", student?.id, schoolId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_payment_plans")
        .select("*, payment_plans(name)")
        .eq("student_id", student.id)
        .eq("school_year_id", schoolYearId)
        .eq("school_id", schoolId)
        .order("assigned_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    initialData: initialStudentPlan || undefined,
    enabled: open && !!student?.id,
  });

  const { data: balances = [] } = useQuery({
    queryKey: ["student-balances", student?.id, schoolYearId],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_concept_balances")
        .select("*, payment_plan_concepts(amount, discount_type, discount_value, display_order, is_mandatory, is_recurring, due_day, payment_concepts(name, concept_type))")
        .eq("student_id", student.id)
        .eq("school_year_id", schoolYearId)
        .eq("school_id", schoolId)
        .order("updated_at");
      if (error) throw error;
      return data;
    },
    enabled: open && !!student?.id,
  });

  // Datos de la familia: default de factura guardado + campos de contacto
  const { data: familyData, isLoading: isLoadingFamily } = useQuery({
    queryKey: ["family-default-invoice", student?.family_id],
    queryFn: async () => {
      if (!student?.family_id) return null;
      const { data } = await supabase.from("families")
        .select("default_invoice, contact_phone, address")
        .eq("id", student.family_id)
        .single();
      return data;
    },
    enabled: open && !!student?.family_id,
  });

  // Todos los representantes de la familia
  const { data: representatives = [], isLoading: isLoadingReps } = useQuery({
    queryKey: ["family-representatives", student?.family_id],
    queryFn: async () => {
      const { data } = await supabase.from("representatives")
        .select("*")
        .eq("family_id", student.family_id)
        .order("created_at");
      return data || [];
    },
    enabled: open && !!student?.family_id,
  });

  const effectivePrimaryRep = useMemo(() =>
    representatives.find((r: any) => r.is_primary) || representatives[0] || null,
    [representatives]
  );

  const profiles = useMemo((): InvoiceProfile[] => {
    const raw = familyData?.default_invoice;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as InvoiceProfile[];
    const obj = raw as any;
    if (obj.name || obj.rif) return [{ id: crypto.randomUUID(), name: obj.name || "", rif: obj.rif || "", phone: obj.phone || "", address: obj.address || "" }];
    return [];
  }, [familyData]);

  // Inicializar datos de factura una sola vez por apertura del modal
  useEffect(() => {
    if (!open || invoiceInitializedRef.current || isLoadingFamily || isLoadingReps) return;

    if (profiles.length === 0) {
      if (effectivePrimaryRep) {
        const fd = effectivePrimaryRep.form_data as Record<string, any> | null;
        const fullName = [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ");
        setInvoice({
          rif: effectivePrimaryRep.document_id || "",
          name: fullName || "",
          phone: effectivePrimaryRep.phone || fd?.numero_contacto || (familyData as any)?.contact_phone || "",
          address: (familyData as any)?.address || "",
        });
      } else {
        setInvoice({ name: "", rif: "", phone: (familyData as any)?.contact_phone || "", address: (familyData as any)?.address || "" });
      }
    }

    invoiceInitializedRef.current = true;
  }, [open, familyData, profiles, effectivePrimaryRep, isLoadingFamily, isLoadingReps]);

  // Reset on open + prefill from report if any
  useEffect(() => {
    if (open) {
      autoSelectedRef.current = false;
      invoiceInitializedRef.current = false;
      setInvoice({ name: "", rif: "", phone: "", address: "" });
      setInvoiceReady(false);
      setEditingProfileId(null);
      setSurplusAction("none");
      setSelectedConcepts({});
      setMethods([createMethodLine()]);
      setObservations("");
      setInvoiceNumber("");
      setControlNumber("");
      if (fromReport) {
        setObservations(`Confirmación del reporte ${fromReport.reference_code || ""} · ${fromReport.notes || ""}`.trim());
        const m = createMethodLine();
        m.method = fromReport.school_payment_method_id || m.method;
        m.currency = fromReport.currency_reported || "VES";
        m.amount_original = String(fromReport.amount_reported || "");
        m.bank_name = fromReport.payer_bank_name || "";
        m.reference_code = fromReport.reference_code || "";
        m.payment_date = fromReport.payment_date || today();
        const r = m.currency === "VES" ? 1 : (rates.find((x) => x.currency === m.currency)?.rate_to_ves || 1);
        m.exchange_rate = String(r);
        m.amount_ves = ((parseFloat(m.amount_original) || 0) * r).toFixed(2);
        m.details = `Reportado por familia · ${fromReport.payer_document || ""} ${fromReport.payer_phone || ""}`.trim();
        setMethods([m]);
      }
    }
  }, [open, fromReport]);

  // Auto-select concept matching the payment report
  useEffect(() => {
    if (!open || !fromReport || autoSelectedRef.current || balances.length === 0) return;
    const match = balances.find((b: any) => b.plan_concept_id === fromReport.plan_concept_id && b.balance > 0);
    if (!match) return;
    const matchCurrency = match.currency || "VES";
    if (matchCurrency !== "VES" && rates.length === 0) return; // Wait for rates to load before calculating
    const currentRate = matchCurrency === "VES" ? 1 : (rates.find((r: any) => r.currency === matchCurrency)?.rate_to_ves || match.exchange_rate_snapshot || 1);
    const displayTotal = matchCurrency === "VES" ? (match.total_amount || 0) : (match.original_amount || 0) * currentRate;
    const displayBalance = Math.max(0, displayTotal - (match.paid_amount || 0));
    setSelectedConcepts({ [match.id]: displayBalance.toFixed(2) });
    autoSelectedRef.current = true;
  }, [balances, rates, open, fromReport]);

  const getRate = (currency: string) => {
    if (currency === "VES") return 1;
    const dbRate = rates.find((r) => r.currency === currency)?.rate_to_ves || 0;
    return applyRateOverride(schoolId, currency, dbRate);
  };

  // Use current exchange rate for display/calculation instead of frozen snapshot
  const getDisplayTotal = (b: any) => b.currency === "VES" ? (b.total_amount || 0) : (b.original_amount || 0) * getRate(b.currency || "VES");
  const getDisplayBalance = (b: any) => Math.max(0, getDisplayTotal(b) - (b.paid_amount || 0));

  // Recalc method VES when currency/amount/rate changes
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

  // Cierra un saldo residual (típicamente diferencia por tasa de cambio) marcándolo como pagado
  const closeBalanceMut = useMutation({
    mutationFn: async (bal: any) => {
      const currentRate = getRate(bal.currency || "VES");
      const newTotalAmount = getDisplayTotal(bal);
      const { error } = await supabase.from("student_concept_balances").update({
        exchange_rate_snapshot: currentRate,
        total_amount: newTotalAmount,
        paid_amount: newTotalAmount,
        balance: 0,
        status: "paid",
        last_payment_date: today(),
      }).eq("id", bal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-balances"] });
      qc.invalidateQueries({ queryKey: ["all-student-balances"] });
      toast({ title: "Concepto marcado como completo", description: "El saldo residual fue ajustado por diferencia cambiaria." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalConcepts = useMemo(() =>
    Object.values(selectedConcepts).reduce((s, v) => s + (parseFloat(v) || 0), 0), [selectedConcepts]);

  const totalMethods = useMemo(() =>
    methods.reduce((s, m) => s + (parseFloat(m.amount_ves) || 0), 0), [methods]);

  const usedCredit = useMemo(() =>
    methods.filter((m) => m.method === FAMILY_CREDIT_METHOD).reduce((s, m) => s + (parseFloat(m.amount_ves) || 0), 0), [methods]);

  const difference = totalMethods - totalConcepts;

  // Cuánto más se le puede aplicar a un balance sin pasar su disponible (ya considerando lo seleccionado)
  const remainingCapacity = (b: any) => Math.max(0, getDisplayBalance(b) - (parseFloat(selectedConcepts[b.id] || "0") || 0));

  const eligibleForSurplus = useMemo(() =>
    balances.filter((b: any) => remainingCapacity(b) > 0.01), [balances, selectedConcepts]);

  const applySurplusToConcept = () => {
    if (!applyToBalanceId) return;
    const bal = balances.find((b: any) => b.id === applyToBalanceId);
    if (!bal) return;
    const amt = Math.min(difference, remainingCapacity(bal));
    if (amt <= 0) return;
    setSelectedConcepts((prev) => ({ ...prev, [applyToBalanceId]: ((parseFloat(prev[applyToBalanceId] || "0") || 0) + amt).toFixed(2) }));
    setApplyToBalanceId("");
  };

  // Guardar o actualizar perfil de factura en el array de la familia
  const saveProfileMut = useMutation({
    mutationFn: async () => {
      const current = Array.isArray(familyData?.default_invoice) ? (familyData!.default_invoice as InvoiceProfile[]) : [];
      const profileId = editingProfileId || crypto.randomUUID();
      const newProfile: InvoiceProfile = { id: profileId, name: invoice.name, rif: invoice.rif, phone: invoice.phone, address: invoice.address };
      const updated = editingProfileId
        ? current.map((p) => p.id === editingProfileId ? newProfile : p)
        : [...current, newProfile];
      const { error } = await supabase.from("families").update({ default_invoice: updated } as any).eq("id", student.family_id);
      if (error) throw error;
      return profileId;
    },
    onSuccess: (profileId) => {
      qc.invalidateQueries({ queryKey: ["family-default-invoice", student.family_id] });
      setEditingProfileId(profileId);
      toast({ title: editingProfileId ? "Perfil actualizado" : "Perfil de factura guardado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Eliminar perfil de factura del array
  const deleteProfileMut = useMutation({
    mutationFn: async (profileId: string) => {
      const current = Array.isArray(familyData?.default_invoice) ? (familyData!.default_invoice as InvoiceProfile[]) : [];
      const updated = current.filter((p) => p.id !== profileId);
      const { error } = await supabase.from("families").update({ default_invoice: updated } as any).eq("id", student.family_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-default-invoice", student.family_id] });
      toast({ title: "Perfil eliminado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Save payment
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!invoiceNumber.trim()) throw new Error("El N° de factura es obligatorio");
      if (Object.keys(selectedConcepts).length === 0) throw new Error("Seleccione al menos un concepto");
      if (methods.length === 0) throw new Error("Agregue al menos una forma de pago");
      if (totalMethods <= 0) throw new Error("El monto total debe ser mayor a 0");
      if (Math.abs(difference) > 0.01 && difference < 0) throw new Error("El monto pagado es insuficiente para cubrir los conceptos seleccionados");
      if (usedCredit > creditBalance + 0.01) throw new Error("El saldo a favor usado supera el disponible de la familia");

      // Create payment
      const { data: payment, error: payErr } = await supabase.from("payments").insert({
        school_id: schoolId,
        student_id: student.id,
        school_year_id: schoolYearId,
        created_by: user!.id,
        payment_date: methods[0]?.payment_date || today(),
        total_amount_ves: totalMethods,
        status: "completed",
        observations: observations || null,
        invoice_number: invoiceNumber.trim(),
        control_number: controlNumber.trim(),
        invoice_name: invoice.name || null,
        invoice_rif: invoice.rif || null,
        invoice_phone: invoice.phone || null,
        invoice_address: invoice.address || null,
      }).select("id").single();
      if (payErr) throw payErr;

      // Insert payment items
      const items = Object.entries(selectedConcepts).map(([balanceId, amountStr]) => {
        const bal = balances.find((b) => b.id === balanceId);
        const amount = parseFloat(amountStr) || 0;
        return {
          payment_id: payment.id,
          plan_concept_id: bal!.plan_concept_id,
          student_id: student.id,
          amount_ves: amount,
          is_partial: amount < getDisplayBalance(bal!) - 0.01,
        };
      });
      const { error: itemErr } = await supabase.from("payment_items").insert(items as any);
      if (itemErr) throw itemErr;

      // Insert payment method entries
      const methodEntries = methods.filter((m) => parseFloat(m.amount_original) > 0).map((m) => ({
        payment_id: payment.id,
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
      if (methodEntries.length > 0) {
        const { error: methErr } = await supabase.from("payment_method_entries").insert(methodEntries);
        if (methErr) throw methErr;
      }

      // Update student concept balances
      for (const [balanceId, amountStr] of Object.entries(selectedConcepts)) {
        const amount = parseFloat(amountStr) || 0;
        const bal = balances.find((b) => b.id === balanceId);
        if (!bal) continue;
        const currentRate = getRate(bal.currency || "VES");
        const newTotalAmount = getDisplayTotal(bal);
        const newPaid = parseFloat(((bal.paid_amount || 0) + amount).toFixed(2));
        const newBalance = parseFloat((newTotalAmount - newPaid).toFixed(2));
        // Absorb residuals ≤ EXCHANGE_RATE_TOLERANCE_VES caused by exchange rate drift
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

      // Guardar sobrepago en "Otros" (ingreso) o como saldo a favor, según lo indicado
      if (surplusAction === "otros" && difference > 0.01) {
        await supabase.from("payment_others").insert({
          payment_id: payment.id,
          school_id: schoolId,
          amount_ves: parseFloat(difference.toFixed(2)),
          invoice_number: invoiceNumber.trim() || null,
          created_by: user!.id,
        });
      }
      if (surplusAction === "credit" && difference > 0.01 && student.family_id) {
        await supabase.from("family_credits").insert({
          school_id: schoolId,
          family_id: student.family_id,
          entry_type: "credit",
          amount_ves: parseFloat(difference.toFixed(2)),
          source_payment_id: payment.id,
          note: observations || `Sobrante de factura ${invoiceNumber.trim()}`,
          created_by: user!.id,
        });
      }

      // Descontar el saldo a favor usado en esta factura
      if (usedCredit > 0.01 && student.family_id) {
        await supabase.from("family_credits").insert({
          school_id: schoolId,
          family_id: student.family_id,
          entry_type: "debit",
          amount_ves: parseFloat(usedCredit.toFixed(2)),
          applied_payment_id: payment.id,
          note: `Aplicado a factura ${invoiceNumber.trim()}`,
          created_by: user!.id,
        });
      }

      return payment.id;
    },
    onSuccess: (paymentId: string) => {
      qc.invalidateQueries({ queryKey: ["student-balances"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["enrolled-students-payments"] });
      qc.invalidateQueries({ queryKey: ["family-credits", student.family_id] });
      toast({ title: "Pago registrado exitosamente" });
      onSaved?.(paymentId);
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const studentName = student ? [
    (student.form_data as any)?.primer_nombre,
    (student.form_data as any)?.segundo_nombre,
    (student.form_data as any)?.primer_apellido,
    (student.form_data as any)?.segundo_apellido,
  ].filter(Boolean).join(" ") : "";

  const sectionName = enrollment?.sections?.name || "";
  const gradeName = formatGradeLevel(enrollment?.sections?.grade_level);
  const resolvedStudentPlan = studentPlan || initialStudentPlan;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[70vw] max-w-[70vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Registrar Pago</DialogTitle></DialogHeader>

        <div className="space-y-6">
          {/* Student Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Estudiante:</span><p className="font-medium">{studentName}</p></div>
                <div><span className="text-muted-foreground">Cédula:</span><p className="font-medium">{student?.document_id || "—"}</p></div>
                <div><span className="text-muted-foreground">Grado/Sección:</span><p className="font-medium">{gradeName} - {sectionName}</p></div>
                <div><span className="text-muted-foreground">Plan:</span><p className="font-medium">{resolvedStudentPlan?.payment_plans?.name || <Badge variant="destructive">Sin plan</Badge>}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* N° Factura y N° Control — datos por pago, siempre visibles */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">N° de Factura <span className="text-destructive">*</span></Label>
                  <Input className="h-8 text-sm" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Obligatorio" required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">N° de Control</Label>
                  <Input className="h-8 text-sm" value={controlNumber} onChange={(e) => setControlNumber(e.target.value)} placeholder="ej: 00-00016725" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Datos del cliente para la factura */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Datos de Factura</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {/* Lista de perfiles guardados */}
              {profiles.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium">Perfiles guardados — haz clic para seleccionar</p>
                  {profiles.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer hover:bg-accent transition-colors ${editingProfileId === p.id ? "border-primary bg-primary/5" : ""}`}
                      onClick={() => { setInvoice({ name: p.name, rif: p.rif, phone: p.phone, address: p.address }); setInvoiceReady(true); setEditingProfileId(null); }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.name || p.rif || "Sin nombre"}</p>
                        <p className="text-xs text-muted-foreground truncate">{[p.phone, p.address].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-6 w-6" title="Editar perfil" onClick={() => { setInvoice({ name: p.name, rif: p.rif, phone: p.phone, address: p.address }); setEditingProfileId(p.id); setInvoiceReady(false); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" title="Eliminar perfil" disabled={deleteProfileMut.isPending} onClick={() => deleteProfileMut.mutate(p.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-1" />
                </div>
              )}

              {/* Campos editables */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1"><Label className="text-xs">RIF / Cédula</Label><Input className="h-8 text-sm" value={invoice.rif} onChange={(e) => setInvoice({ ...invoice, rif: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Nombre / Razón Social</Label><Input className="h-8 text-sm" value={invoice.name} onChange={(e) => setInvoice({ ...invoice, name: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Teléfono</Label><Input className="h-8 text-sm" value={invoice.phone} onChange={(e) => setInvoice({ ...invoice, phone: e.target.value })} /></div>
                <div className="space-y-1 md:col-span-3"><Label className="text-xs">Dirección</Label><Input className="h-8 text-sm" value={invoice.address} onChange={(e) => setInvoice({ ...invoice, address: e.target.value })} /></div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => saveProfileMut.mutate()}
                  disabled={saveProfileMut.isPending || !student?.family_id}
                >
                  {saveProfileMut.isPending && <Loader2 className="animate-spin h-3 w-3 mr-1" />}
                  {editingProfileId ? "Actualizar perfil" : "Guardar como predeterminado"}
                </Button>
                {!invoiceReady ? (
                  <Button size="sm" onClick={() => setInvoiceReady(true)}>
                    Confirmar datos de factura
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => { setInvoiceReady(false); setEditingProfileId(null); }}>
                    Editar datos de factura
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {invoiceReady && <>
          {/* Concepts Selection */}
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Conceptos a Cancelar</CardTitle>
              <Badge variant="outline">Total: {totalConcepts.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</Badge>
            </CardHeader>
            <CardContent>
              {balances.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No hay conceptos pendientes. Asegúrese de que el alumno tenga un plan asignado con saldos inicializados.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Pagado</TableHead>
                      <TableHead>Pendiente</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Monto a pagar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balances.filter((b) => b.balance > 0).map((b: any) => {
                      const conceptName = (b.payment_plan_concepts as any)?.payment_concepts?.name || "—";
                      const cur = b.currency || "VES";
                      const isSelected = b.id in selectedConcepts;
                      const displayTotal = getDisplayTotal(b);
                      const displayBalance = getDisplayBalance(b);
                      return (
                        <TableRow key={b.id} className={isSelected ? "bg-primary/5" : ""}>
                          <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleConcept(b.id, displayBalance)} /></TableCell>
                          <TableCell className="font-medium">
                            {conceptName}
                            {(() => {
                              const ppc = (b.payment_plan_concepts as any) || {};
                              const dType = ppc.discount_type;
                              const dValue = Number(ppc.discount_value || 0);
                              if ((dType !== "percentage" && dType !== "fixed") || dValue <= 0) return null;
                              const label = dType === "percentage"
                                ? `-${dValue.toLocaleString("es-VE", { maximumFractionDigits: 2 })}%`
                                : `-${dValue.toLocaleString("es-VE", { minimumFractionDigits: 2 })} ${cur}`;
                              return (
                                <Badge
                                  variant="outline"
                                  className="ml-2 gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                  title="Descuento del plan"
                                >
                                  <Tag className="h-3 w-3" />
                                  {label}
                                </Badge>
                              );
                            })()}
                            {cur !== "VES" && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({Number(b.original_amount || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {cur} @ {Number(getRate(cur)).toLocaleString("es-VE", { minimumFractionDigits: 2 })})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{displayTotal.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>{b.paid_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="font-medium">{displayBalance.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>
                            <Badge variant={b.status === "paid" ? "default" : b.status === "partial" ? "secondary" : "outline"}>
                              {b.status === "paid" ? "Pagado" : b.status === "partial" ? "Parcial" : "Pendiente"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-7 w-28 text-xs"
                                  value={selectedConcepts[b.id]}
                                  onChange={(e) => {
                                    const val = Math.min(parseFloat(e.target.value) || 0, displayBalance);
                                    setSelectedConcepts((p) => ({ ...p, [b.id]: val.toFixed(2) }));
                                  }}
                                />
                              )}
                              {b.paid_amount > 0 && displayBalance > 0 && displayBalance < (displayTotal * 0.05) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1"
                                  title="Cerrar saldo residual por diferencia cambiaria"
                                  disabled={closeBalanceMut.isPending}
                                  onClick={() => closeBalanceMut.mutate(b)}
                                >
                                  <CheckCheck className="h-3 w-3" />
                                  Marcar completo
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardHeader className="py-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">Formas de Pago</CardTitle>
                {creditBalance > 0.01 && (
                  <Badge variant="outline" className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    <Tag className="h-3 w-3" />
                    Saldo a favor: {creditBalance.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
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
                          {creditBalance > 0.01 && <SelectItem value={FAMILY_CREDIT_METHOD}>{FAMILY_CREDIT_LABEL}</SelectItem>}
                        </SelectContent>
                      </Select>
                      {!isCreditLine && (() => {
                        const selected = methodOptions.find((mo) => mo.value === m.method);
                        if (!selected || !selected.config || Object.keys(selected.config).length === 0) return null;
                        const cfg = selected.config as Record<string, any>;
                        const details = [cfg.bank_name, cfg.account_number ? `Cta: ...${cfg.account_number.slice(-4)}` : null, cfg.account_holder, cfg.phone, cfg.email, cfg.document_id].filter(Boolean);
                        if (details.length === 0) return null;
                        return <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{details.join(" · ")}</p>;
                      })()}
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

          {/* Observations */}
          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} placeholder="Notas adicionales..." />
          </div>

          {/* Summary */}
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
                                    {label} (disp. {cap.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES)
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
                        {student.family_id && (
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
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || Object.keys(selectedConcepts).length === 0}>
              {saveMut.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
              Registrar Pago
            </Button>
          </div>
          </>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
