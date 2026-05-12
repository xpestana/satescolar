import { useState, useEffect, useMemo } from "react";
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
import { Plus, Trash2, Loader2, Receipt, AlertTriangle } from "lucide-react";
import { formatGradeLevel } from "@/lib/utils";

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

const today = () => new Date().toISOString().split("T")[0];

function createMethodLine(): PaymentMethodLine {
  return { id: crypto.randomUUID(), method: "transferencia", currency: "VES", amount_original: "", exchange_rate: "1", amount_ves: "", reference_code: "", bank_name: "", payment_date: today(), details: "" };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  student: any;
  enrollment: any;
  schoolId: string;
  schoolYearId: string;
  initialStudentPlan?: any;
}

export function PaymentFormModal({ open, onOpenChange, student, enrollment, schoolId, schoolYearId, initialStudentPlan }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Invoice data
  const [invoice, setInvoice] = useState({ name: "", rif: "", phone: "", address: "" });
  const [observations, setObservations] = useState("");
  const [selectedConcepts, setSelectedConcepts] = useState<Record<string, string>>({});
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
        .select("*, payment_plan_concepts(amount, display_order, is_mandatory, is_recurring, due_day, payment_concepts(name, concept_type))")
        .eq("student_id", student.id)
        .eq("school_year_id", schoolYearId)
        .eq("school_id", schoolId)
        .order("updated_at");
      if (error) throw error;
      return data;
    },
    enabled: open && !!student?.id,
  });

  // Load representative for invoice defaults
  const { data: primaryRep } = useQuery({
    queryKey: ["primary-rep", student?.family_id],
    queryFn: async () => {
      const { data } = await supabase.from("representatives")
        .select("*")
        .eq("family_id", student.family_id)
        .eq("is_primary", true)
        .maybeSingle();
      return data;
    },
    enabled: open && !!student?.family_id,
  });

  // Set invoice defaults from representative
  useEffect(() => {
    if (primaryRep && open) {
      const fd = primaryRep.form_data as Record<string, any> | null;
      // Use document_id directly — it already contains the prefix (e.g. "V-12345678")
      const doc = primaryRep.document_id || "";
      const fullName = [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ");
      setInvoice({
        rif: doc,
        name: fullName || "",
        phone: primaryRep.phone || fd?.numero_contacto || "",
        address: "",
      });
    }
  }, [primaryRep, open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSelectedConcepts({});
      setMethods([createMethodLine()]);
      setObservations("");
    }
  }, [open]);

  const getRate = (currency: string) => {
    if (currency === "VES") return 1;
    return rates.find((r) => r.currency === currency)?.rate_to_ves || 0;
  };

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

  const totalConcepts = useMemo(() =>
    Object.values(selectedConcepts).reduce((s, v) => s + (parseFloat(v) || 0), 0), [selectedConcepts]);

  const totalMethods = useMemo(() =>
    methods.reduce((s, m) => s + (parseFloat(m.amount_ves) || 0), 0), [methods]);

  const difference = totalMethods - totalConcepts;

  // Save payment
  const saveMut = useMutation({
    mutationFn: async () => {
      if (Object.keys(selectedConcepts).length === 0) throw new Error("Seleccione al menos un concepto");
      if (methods.length === 0) throw new Error("Agregue al menos una forma de pago");
      if (totalMethods <= 0) throw new Error("El monto total debe ser mayor a 0");
      if (Math.abs(difference) > 0.01 && difference < 0) throw new Error("El monto pagado es insuficiente para cubrir los conceptos seleccionados");

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
          amount_ves: amount,
          is_partial: amount < (bal?.balance || 0),
        };
      });
      const { error: itemErr } = await supabase.from("payment_items").insert(items);
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
        const newPaid = (bal.paid_amount || 0) + amount;
        const newBalance = (bal.total_amount || 0) - newPaid;
        const newStatus = newBalance <= 0 ? "paid" : "partial";
        await supabase.from("student_concept_balances").update({
          paid_amount: newPaid,
          balance: Math.max(0, newBalance),
          status: newStatus,
          last_payment_date: today(),
        }).eq("id", balanceId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-balances"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["enrolled-students-payments"] });
      toast({ title: "Pago registrado exitosamente" });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" />Registrar Pago</DialogTitle></DialogHeader>

        <div className="space-y-6">
          {/* Student Info */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Estudiante:</span><p className="font-medium">{studentName}</p></div>
                <div><span className="text-muted-foreground">Cédula:</span><p className="font-medium">{student?.document_id || "—"}</p></div>
                <div><span className="text-muted-foreground">Grado/Sección:</span><p className="font-medium">{gradeName} - {sectionName}</p></div>
                <div><span className="text-muted-foreground">Plan:</span><p className="font-medium">{studentPlan?.payment_plans?.name || <Badge variant="destructive">Sin plan</Badge>}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Data */}
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-sm">Datos de Factura</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1"><Label className="text-xs">RIF / Cédula</Label><Input className="h-8 text-sm" value={invoice.rif} onChange={(e) => setInvoice({ ...invoice, rif: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Nombre / Razón Social</Label><Input className="h-8 text-sm" value={invoice.name} onChange={(e) => setInvoice({ ...invoice, name: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Teléfono</Label><Input className="h-8 text-sm" value={invoice.phone} onChange={(e) => setInvoice({ ...invoice, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Dirección</Label><Input className="h-8 text-sm" value={invoice.address} onChange={(e) => setInvoice({ ...invoice, address: e.target.value })} /></div>
              </div>
            </CardContent>
          </Card>

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
                      return (
                        <TableRow key={b.id} className={isSelected ? "bg-primary/5" : ""}>
                          <TableCell><Checkbox checked={isSelected} onCheckedChange={() => toggleConcept(b.id, b.balance)} /></TableCell>
                          <TableCell className="font-medium">
                            {conceptName}
                            {cur !== "VES" && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({Number(b.original_amount || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })} {cur} @ {Number(b.exchange_rate_snapshot || 1).toLocaleString("es-VE", { minimumFractionDigits: 2 })})
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{b.total_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell>{b.paid_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="font-medium">{b.balance?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
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
                                  const val = Math.min(parseFloat(e.target.value) || 0, b.balance);
                                  setSelectedConcepts((p) => ({ ...p, [b.id]: val.toFixed(2) }));
                                }}
                              />
                            )}
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
              <CardTitle className="text-sm">Formas de Pago</CardTitle>
              <Button size="sm" variant="outline" onClick={addMethod}><Plus className="h-3 w-3 mr-1" />Agregar</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {methods.map((m, idx) => (
                <div key={m.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-muted-foreground">Pago #{idx + 1}</span>
                    {methods.length > 1 && <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeMethod(m.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Método</Label>
                      <Select value={m.method} onValueChange={(v) => updateMethodField(m.id, "method", v)}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{methodOptions.map((mt) => <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>)}</SelectContent>
                      </Select>
                      {(() => {
                        const selected = methodOptions.find((mo) => mo.value === m.method);
                        if (!selected || !selected.config || Object.keys(selected.config).length === 0) return null;
                        const cfg = selected.config as Record<string, any>;
                        const details = [cfg.bank_name, cfg.account_number ? `Cta: ...${cfg.account_number.slice(-4)}` : null, cfg.account_holder, cfg.phone, cfg.email, cfg.document_id].filter(Boolean);
                        if (details.length === 0) return null;
                        return <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{details.join(" · ")}</p>;
                      })()}
                    </div>
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
                    <div className="space-y-1"><Label className="text-xs">Monto ({m.currency})</Label><Input type="number" step="0.01" className="h-8 text-xs" value={m.amount_original} onChange={(e) => updateMethodField(m.id, "amount_original", e.target.value)} /></div>
                    {m.currency !== "VES" && (
                      <div className="space-y-1"><Label className="text-xs">Tasa</Label><Input type="number" step="0.01" className="h-8 text-xs" value={m.exchange_rate} onChange={(e) => updateMethodField(m.id, "exchange_rate", e.target.value)} /></div>
                    )}
                    <div className="space-y-1"><Label className="text-xs">= VES</Label><Input className="h-8 text-xs bg-muted" value={parseFloat(m.amount_ves || "0").toLocaleString("es-VE", { minimumFractionDigits: 2 })} readOnly /></div>
                    <div className="space-y-1"><Label className="text-xs">Referencia</Label><Input className="h-8 text-xs" value={m.reference_code} onChange={(e) => updateMethodField(m.id, "reference_code", e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Banco</Label><Input className="h-8 text-xs" value={m.bank_name} onChange={(e) => updateMethodField(m.id, "bank_name", e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">Fecha</Label><Input type="date" className="h-8 text-xs" value={m.payment_date} onChange={(e) => updateMethodField(m.id, "payment_date", e.target.value)} /></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Observations */}
          <div className="space-y-1">
            <Label>Observaciones</Label>
            <Textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={2} placeholder="Notas adicionales..." />
          </div>

          {/* Summary */}
          <Card className={Math.abs(difference) > 0.01 ? "border-yellow-500" : "border-green-500"}>
            <CardContent className="pt-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><span className="text-muted-foreground">Total Conceptos:</span><p className="text-lg font-bold">{totalConcepts.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></div>
                <div><span className="text-muted-foreground">Total Pagado:</span><p className="text-lg font-bold">{totalMethods.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></div>
                <div>
                  <span className="text-muted-foreground">Diferencia:</span>
                  <p className={`text-lg font-bold ${Math.abs(difference) < 0.01 ? "text-green-600" : difference > 0 ? "text-blue-600" : "text-destructive"}`}>
                    {difference > 0 ? "+" : ""}{difference.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
                    {difference > 0.01 && " (Sobrepago)"}
                    {difference < -0.01 && " (Insuficiente)"}
                  </p>
                </div>
              </div>
              {Math.abs(difference) > 0.01 && (
                <div className="flex items-center gap-2 mt-2 text-xs text-yellow-600"><AlertTriangle className="h-4 w-4" />{difference > 0 ? "Existe un sobrepago. Verifique los montos." : "El monto pagado no cubre el total seleccionado."}</div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
