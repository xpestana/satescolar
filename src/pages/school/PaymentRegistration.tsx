import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Search, AlertTriangle, DollarSign, Trash2 } from "lucide-react";
import { ExchangeRateWidget } from "@/components/payments/ExchangeRateWidget";
import { ConceptSelector } from "@/components/payments/ConceptSelector";
import { PaymentMethodRow, PaymentMethodData, getAmountVes } from "@/components/payments/PaymentMethodRow";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

const today = new Date().toISOString().slice(0, 10);

function createEmptyMethod(): PaymentMethodData {
  return { id: crypto.randomUUID(), method: "transferencia", bank_name: "", reference_code: "", amount_original: "", currency: "VES", exchange_rate: "1", payment_date: today, details: "" };
}

export default function PaymentRegistration() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [paymentModal, setPaymentModal] = useState(false);

  // Payment form state
  const [invoiceRif, setInvoiceRif] = useState("");
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceAddress, setInvoiceAddress] = useState("");
  const [invoicePhone, setInvoicePhone] = useState("");
  const [observations, setObservations] = useState("");
  const [selectedConceptIds, setSelectedConceptIds] = useState<string[]>([]);
  const [partialAmounts, setPartialAmounts] = useState<Record<string, number>>({});
  const [methods, setMethods] = useState<PaymentMethodData[]>([createEmptyMethod()]);
  const [saving, setSaving] = useState(false);

  // Exchange rates
  const [ratesMap, setRatesMap] = useState<Record<string, number>>({ USD: 1, EUR: 1, COP: 1 });

  // Active school year
  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("*").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  // Exchange rates from DB
  const { data: dbRates = [] } = useQuery({
    queryKey: ["exchange-rates", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("exchange_rates").select("*").eq("school_id", schoolId!);
      return data || [];
    },
    enabled: !!schoolId,
  });

  useMemo(() => {
    const m: Record<string, number> = { USD: 1, EUR: 1, COP: 1 };
    dbRates.forEach((r: any) => { m[r.currency] = Number(r.rate_to_ves); });
    setRatesMap(m);
  }, [dbRates]);

  // Students with enrollments in active year
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["payment-students", schoolId, activeYear?.id],
    queryFn: async () => {
      if (!activeYear?.id) return [];
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, sections(name, grade_level), students(id, form_data, family_id)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear.id);

      if (!enrollments) return [];

      // Get student payment plans
      const studentIds = enrollments.map((e: any) => e.student_id);
      const { data: spp } = await supabase
        .from("student_payment_plans")
        .select("student_id, plan_id, payment_plans(name)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear.id)
        .in("student_id", studentIds);

      // Get balances
      const { data: balances } = await supabase
        .from("student_concept_balances")
        .select("student_id, balance, status")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear.id)
        .in("student_id", studentIds);

      const planMap = new Map((spp || []).map((s: any) => [s.student_id, s]));
      const balanceMap = new Map<string, { totalDebt: number; hasOverdue: boolean }>();
      (balances || []).forEach((b: any) => {
        const cur = balanceMap.get(b.student_id) || { totalDebt: 0, hasOverdue: false };
        cur.totalDebt += Number(b.balance);
        if (b.status === "overdue") cur.hasOverdue = true;
        balanceMap.set(b.student_id, cur);
      });

      return enrollments.map((e: any) => {
        const fd = e.students?.form_data as any || {};
        const plan = planMap.get(e.student_id);
        const bal = balanceMap.get(e.student_id);
        return {
          id: e.student_id,
          firstName: `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""}`.trim(),
          lastName: `${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.trim(),
          document: fd.documento || "",
          gradeLevel: (e.sections as any)?.grade_level || "",
          section: (e.sections as any)?.name || "",
          familyId: e.students?.family_id,
          planName: (plan as any)?.payment_plans?.name || "Sin plan",
          planId: (plan as any)?.plan_id || null,
          totalDebt: bal?.totalDebt || 0,
          hasOverdue: bal?.hasOverdue || false,
        };
      });
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = normalize(search);
    return students.filter((s: any) =>
      normalize(`${s.firstName} ${s.lastName} ${s.document}`).includes(q)
    );
  }, [students, search]);

  // Load concept balances when student selected
  const { data: conceptBalances = [] } = useQuery({
    queryKey: ["student-balances", selectedStudent?.id, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_concept_balances")
        .select("*, payment_plan_concepts(*, payment_concepts(name, concept_type))")
        .eq("student_id", selectedStudent!.id)
        .eq("school_year_id", activeYear!.id)
        .eq("school_id", schoolId!);
      return (data || []).map((b: any) => ({
        id: b.id,
        plan_concept_id: b.plan_concept_id,
        concept_name: b.payment_plan_concepts?.payment_concepts?.name || "—",
        concept_type: b.payment_plan_concepts?.payment_concepts?.concept_type || "otro",
        total_amount: Number(b.total_amount),
        paid_amount: Number(b.paid_amount),
        balance: Number(b.balance),
        status: b.status,
      }));
    },
    enabled: !!selectedStudent?.id && !!activeYear?.id,
  });

  // Load representative info
  const { data: repInfo } = useQuery({
    queryKey: ["rep-info", selectedStudent?.familyId],
    queryFn: async () => {
      const { data: reps } = await supabase.from("representatives").select("*").eq("family_id", selectedStudent!.familyId).eq("is_primary", true).maybeSingle();
      const { data: family } = await supabase.from("families").select("address, contact_phone").eq("id", selectedStudent!.familyId).maybeSingle();
      const fd = (reps?.form_data as any) || {};
      return {
        rif: fd.documento ? `${fd.tipo_documento || "V"}-${fd.documento}` : "",
        name: `${fd.primer_nombre || ""} ${fd.primer_apellido || ""}`.trim(),
        address: family?.address || "",
        phone: family?.contact_phone || reps?.phone || "",
      };
    },
    enabled: !!selectedStudent?.familyId,
  });

  const openPaymentForm = (student: any) => {
    setSelectedStudent(student);
    setSelectedConceptIds([]);
    setPartialAmounts({});
    setMethods([createEmptyMethod()]);
    setObservations("");
    setPaymentModal(true);
  };

  // Set invoice defaults from rep
  useMemo(() => {
    if (repInfo && paymentModal) {
      setInvoiceRif(repInfo.rif);
      setInvoiceName(repInfo.name);
      setInvoiceAddress(repInfo.address);
      setInvoicePhone(repInfo.phone);
    }
  }, [repInfo, paymentModal]);

  const totalConcepts = conceptBalances
    .filter((b: any) => selectedConceptIds.includes(b.plan_concept_id))
    .reduce((sum: number, b: any) => {
      const amt = partialAmounts[b.plan_concept_id] !== undefined ? partialAmounts[b.plan_concept_id] : b.balance;
      return sum + amt;
    }, 0);

  const totalMethods = methods.reduce((sum, m) => sum + getAmountVes(m, ratesMap), 0);

  const handleSavePayment = async () => {
    if (selectedConceptIds.length === 0) return toast.error("Selecciona al menos un concepto");
    if (methods.some(m => !parseFloat(m.amount_original))) return toast.error("Completa los montos de pago");

    setSaving(true);
    try {
      // 1. Create payment header
      const { data: payment, error: payErr } = await supabase.from("payments").insert({
        school_id: schoolId!,
        student_id: selectedStudent.id,
        school_year_id: activeYear!.id,
        total_amount_ves: totalMethods,
        observations,
        invoice_rif: invoiceRif,
        invoice_name: invoiceName,
        invoice_address: invoiceAddress,
        invoice_phone: invoicePhone,
        created_by: user!.id,
      }).select("id").single();

      if (payErr) throw payErr;

      // 2. Insert payment items
      const items = selectedConceptIds.map(pcId => {
        const bal = conceptBalances.find((b: any) => b.plan_concept_id === pcId);
        const amt = partialAmounts[pcId] !== undefined ? partialAmounts[pcId] : (bal?.balance || 0);
        return {
          payment_id: payment.id,
          plan_concept_id: pcId,
          amount_ves: amt,
          is_partial: partialAmounts[pcId] !== undefined && partialAmounts[pcId] < (bal?.balance || 0),
        };
      });
      await supabase.from("payment_items").insert(items);

      // 3. Insert payment methods
      const methodEntries = methods.map(m => ({
        payment_id: payment.id,
        method: m.method,
        bank_name: m.bank_name,
        reference_code: m.reference_code,
        amount_original: parseFloat(m.amount_original) || 0,
        currency: m.currency,
        exchange_rate: parseFloat(m.exchange_rate) || 1,
        amount_ves: getAmountVes(m, ratesMap),
        payment_date: m.payment_date,
        details: m.details,
      }));
      await supabase.from("payment_method_entries").insert(methodEntries);

      // 4. Update balances
      for (const pcId of selectedConceptIds) {
        const bal = conceptBalances.find((b: any) => b.plan_concept_id === pcId);
        if (!bal) continue;
        const amt = partialAmounts[pcId] !== undefined ? partialAmounts[pcId] : bal.balance;
        const newPaid = bal.paid_amount + amt;
        const newBalance = bal.total_amount - newPaid;
        const newStatus = newBalance <= 0 ? "paid" : "partial";
        await supabase.from("student_concept_balances").update({
          paid_amount: newPaid,
          balance: Math.max(0, newBalance),
          status: newStatus,
          last_payment_date: new Date().toISOString(),
        }).eq("id", bal.id);
      }

      toast.success("Pago registrado exitosamente");
      setPaymentModal(false);
      queryClient.invalidateQueries({ queryKey: ["payment-students"] });
      queryClient.invalidateQueries({ queryKey: ["student-balances"] });
    } catch (e: any) {
      toast.error("Error al registrar pago: " + (e.message || ""));
    } finally {
      setSaving(false);
    }
  };

  if (schoolLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Registro de Pagos" breadcrumbs={[{ label: "Pagos" }, { label: "Registro" }]} />

      {!activeYear && (
        <Card className="mb-4 border-destructive"><CardContent className="py-4 flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />No hay un año escolar activo configurado</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar alumno por nombre, apellido o cédula..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {studentsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Saldo Pendiente</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                    <TableCell>{s.document || "—"}</TableCell>
                    <TableCell>{s.gradeLevel}</TableCell>
                    <TableCell>{s.section}</TableCell>
                    <TableCell>
                      <Badge variant={s.planId ? "secondary" : "outline"}>{s.planName}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={s.hasOverdue ? "text-destructive font-semibold" : ""}>
                        Bs. {s.totalDebt.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                      </span>
                      {s.hasOverdue && <Badge variant="destructive" className="ml-2 text-[10px]">Moroso</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openPaymentForm(s)} disabled={!s.planId}>
                        <DollarSign className="h-4 w-4 mr-1" />Pagar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No se encontraron alumnos</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* PAYMENT FORM MODAL */}
      <Dialog open={paymentModal} onOpenChange={setPaymentModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Pago — {selectedStudent?.firstName} {selectedStudent?.lastName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Student info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-muted/50 rounded-lg p-3">
              <div><span className="text-xs text-muted-foreground">Alumno</span><p className="text-sm font-medium">{selectedStudent?.firstName} {selectedStudent?.lastName}</p></div>
              <div><span className="text-xs text-muted-foreground">Grado / Sección</span><p className="text-sm font-medium">{selectedStudent?.gradeLevel} — {selectedStudent?.section}</p></div>
              <div><span className="text-xs text-muted-foreground">Plan</span><p className="text-sm font-medium">{selectedStudent?.planName}</p></div>
              <div><span className="text-xs text-muted-foreground">Año Escolar</span><p className="text-sm font-medium">{activeYear?.year_range}</p></div>
            </div>

            {/* Invoice data */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Datos de Factura / Recibo</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label className="text-xs">RIF / Cédula</Label><Input className="h-8" value={invoiceRif} onChange={e => setInvoiceRif(e.target.value)} /></div>
                <div><Label className="text-xs">Nombre / Razón Social</Label><Input className="h-8" value={invoiceName} onChange={e => setInvoiceName(e.target.value)} /></div>
                <div><Label className="text-xs">Dirección</Label><Input className="h-8" value={invoiceAddress} onChange={e => setInvoiceAddress(e.target.value)} /></div>
                <div><Label className="text-xs">Teléfono</Label><Input className="h-8" value={invoicePhone} onChange={e => setInvoicePhone(e.target.value)} /></div>
              </div>
            </div>

            {/* Concepts */}
            <ConceptSelector
              balances={conceptBalances}
              selectedIds={selectedConceptIds}
              partialAmounts={partialAmounts}
              onToggle={id => setSelectedConceptIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
              onPartialAmountChange={(id, amt) => setPartialAmounts(prev => ({ ...prev, [id]: amt }))}
            />

            {/* Payment methods */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Formas de Pago</h4>
                <Button variant="outline" size="sm" onClick={() => setMethods(prev => [...prev, createEmptyMethod()])}>
                  <Plus className="h-4 w-4 mr-1" />Agregar
                </Button>
              </div>
              {methods.map((m, idx) => (
                <PaymentMethodRow
                  key={m.id}
                  data={m}
                  rates={ratesMap}
                  onChange={updated => setMethods(prev => prev.map((p, i) => i === idx ? updated : p))}
                  onRemove={() => setMethods(prev => prev.filter((_, i) => i !== idx))}
                  canRemove={methods.length > 1}
                />
              ))}
            </div>

            {/* Observations */}
            <div>
              <Label>Observaciones</Label>
              <Textarea value={observations} onChange={e => setObservations(e.target.value)} placeholder="Notas adicionales..." />
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm"><span>Total conceptos seleccionados:</span><span className="font-semibold">Bs. {totalConcepts.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span></div>
              <div className="flex justify-between text-sm"><span>Total formas de pago:</span><span className="font-semibold">Bs. {totalMethods.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span></div>
              {Math.abs(totalConcepts - totalMethods) > 0.01 && (
                <div className="flex justify-between text-sm text-destructive">
                  <span>Diferencia:</span>
                  <span className="font-semibold">Bs. {Math.abs(totalConcepts - totalMethods).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModal(false)}>Cancelar</Button>
            <Button onClick={handleSavePayment} disabled={saving || selectedConceptIds.length === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Registrar Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {schoolId && <ExchangeRateWidget schoolId={schoolId} rates={ratesMap} onRatesChange={setRatesMap} />}
    </DashboardLayout>
  );
}
