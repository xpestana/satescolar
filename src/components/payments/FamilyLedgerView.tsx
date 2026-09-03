import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Download, Ban, Eye, Printer, Users } from "lucide-react";
import { printInvoiceOverlay } from "@/components/payments/InvoiceOverlayPrint";
import { buildInvoiceData } from "@/lib/buildInvoiceData";
import { downloadPaymentReceiptPdf } from "@/lib/paymentReceiptPdf";
import { itemCoverageVes } from "@/lib/paymentItemDiscount";
import { conceptStatusLabel, conceptStatusVariant } from "@/lib/paymentStatus";
import { useConceptExonerations } from "@/hooks/payments/useConceptExonerations";
import { ExonerateConceptCell } from "@/components/payments/ExonerateConceptCell";
import { InvoiceTemplate } from "@/pages/school/InvoiceTemplateConfig";
import { formatGradeLevel } from "@/lib/utils";
import { formatDateOnly } from "@/lib/dateUtils";
import { familySurname, buildPrimaryRepMap } from "@/lib/familyDisplayName";
import { useFamilyCredits } from "@/hooks/payments/useFamilyCredits";

interface Props {
  schoolId: string;
  activeYear: any;
}

const studentFullName = (student: any) => {
  const fd = student?.form_data as any;
  return [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ") || "Sin nombre";
};

export function FamilyLedgerView({ schoolId, activeYear }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Estudiantes activos/suspendidos del colegio (inscritos o no).
  // Egresados/culminados quedan excluidos junto con sus cuotas.
  const { data: schoolStudents = [], isLoading } = useQuery({
    queryKey: ["family-ledger-students", schoolId],
    queryFn: async () => {
      const { data: ss, error: ssError } = await supabase
        .from("student_schools")
        .select("student_id")
        .eq("school_id", schoolId);
      if (ssError) throw ssError;
      const ids = ss.map((r: any) => r.student_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, document_id, form_data, family_id, status")
        .in("id", ids)
        .in("status", ["active", "suspended"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Inscripciones del año activo (para mostrar grado/sección si está inscrito)
  const { data: enrollments = [] } = useQuery({
    queryKey: ["family-ledger-enrollments", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments")
        .select("*, sections(name, grade_level)")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id);
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  const familyIds = useMemo(
    () => [...new Set(schoolStudents.map((s: any) => s.family_id).filter(Boolean))] as string[],
    [schoolStudents],
  );

  const { data: families = [] } = useQuery({
    queryKey: ["family-ledger-families", schoolId, familyIds],
    queryFn: async () => {
      const { data } = await supabase.from("families")
        .select("id, user_id, father_last_name, mother_last_name")
        .in("id", familyIds);
      return data || [];
    },
    enabled: familyIds.length > 0,
  });

  // Representantes (apellido de respaldo desde el principal cuando la familia no los tiene)
  const { data: representatives = [] } = useQuery({
    queryKey: ["family-ledger-reps", schoolId, familyIds],
    queryFn: async () => {
      const { data } = await supabase.from("representatives")
        .select("family_id, is_primary, form_data")
        .in("family_id", familyIds);
      return data || [];
    },
    enabled: familyIds.length > 0,
  });

  const primaryRepByFamily = useMemo(() => buildPrimaryRepMap(representatives as any[]), [representatives]);

  const enrollmentByStudent = useMemo(() => {
    const m: Record<string, any> = {};
    enrollments.forEach((e: any) => { m[e.student_id] = e; });
    return m;
  }, [enrollments]);

  // Hijos activos/suspendidos por familia, cada uno con su inscripción si la tiene
  const childrenByFamily = useMemo(() => {
    const map: Record<string, Array<{ student: any; enrollment: any | null }>> = {};
    schoolStudents.forEach((s: any) => {
      if (!s.family_id) return;
      if (!map[s.family_id]) map[s.family_id] = [];
      map[s.family_id].push({ student: s, enrollment: enrollmentByStudent[s.id] || null });
    });
    return map;
  }, [schoolStudents, enrollmentByStudent]);

  const familyName = (f: any) => familySurname(f, primaryRepByFamily[f?.id]);

  const selectedFamily = families.find((f: any) => f.id === selectedFamilyId);
  const familyChildren = selectedFamilyId ? (childrenByFamily[selectedFamilyId] || []) : [];
  const childIds = useMemo(() => familyChildren.map((c) => c.student?.id).filter(Boolean), [familyChildren]);

  const studentNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    familyChildren.forEach((c) => { m[c.student?.id] = studentFullName(c.student); });
    return m;
  }, [familyChildren]);

  // Pagos: familiares + individuales históricos de los hijos
  const { data: payments = [] } = useQuery({
    queryKey: ["family-payments-ledger", selectedFamilyId, schoolId, activeYear?.id],
    queryFn: async () => {
      const parts = [`family_id.eq.${selectedFamilyId}`];
      if (childIds.length > 0) parts.push(`student_id.in.(${childIds.join(",")})`);
      const { data, error } = (await supabase.from("payments")
        .select("*, payment_items(*, payment_plan_concepts(concept_id, payment_concepts(id, name))), payment_method_entries(*)")
        .or(parts.join(","))
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id)
        .order("payment_date", { ascending: false })) as any;
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!selectedFamilyId && !!activeYear?.id,
  });

  // Saldos de todos los hijos
  const { data: balances = [] } = useQuery({
    queryKey: ["family-balances-ledger", selectedFamilyId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_concept_balances")
        .select("*, payment_plan_concepts(payment_concepts(name))")
        .in("student_id", childIds)
        .eq("school_year_id", activeYear.id)
        .eq("school_id", schoolId);
      return data || [];
    },
    enabled: !!selectedFamilyId && childIds.length > 0 && !!activeYear?.id,
  });

  const { data: schoolMethods = [] } = useQuery({
    queryKey: ["school-payment-methods-ledger", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_payment_methods").select("id, label").eq("school_id", schoolId);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: activeTemplate } = useQuery({
    queryKey: ["active-invoice-template", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_templates" as any)
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();
      return data as unknown as InvoiceTemplate | null;
    },
    enabled: !!schoolId,
  });

  const methodLabel = (raw: string) => {
    const found = schoolMethods.find((sm: any) => sm.id === raw);
    if (found) return found.label;
    if (!raw) return "—";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const filteredFamilies = useMemo(() => {
    const rows = families
      .filter((f: any) => (childrenByFamily[f.id] || []).length > 0)
      .sort((a: any, b: any) => familyName(a).localeCompare(familyName(b)));
    if (!search.trim()) return rows;
    const q = normalize(search);
    return rows.filter((f: any) => {
      if (normalize(familyName(f)).includes(q)) return true;
      return (childrenByFamily[f.id] || []).some((c) =>
        normalize(studentFullName(c.student)).includes(q) || normalize(c.student?.document_id || "").includes(q));
    });
  }, [families, childrenByFamily, search, primaryRepByFamily]);

  const totalCharges = useMemo(() => balances.reduce((s: number, b: any) => s + (b.total_amount || 0), 0), [balances]);
  const { byBalanceId: exonerationByBalance, revert } = useConceptExonerations({
    schoolId,
    schoolYearId: activeYear?.id,
    studentIds: childIds,
  });

  const totalDebt = useMemo(() => balances.reduce((s: number, b: any) => s + (b.balance || 0), 0), [balances]);
  const totalExonerated = useMemo(
    () => Object.values(exonerationByBalance).reduce((s: number, e: any) => s + (Number(e.amount_ves) || 0), 0),
    [exonerationByBalance],
  );
  // Lo exonerado vive dentro de paid_amount (invariante del ledger), pero no es dinero cobrado
  const totalPaid = useMemo(
    () => Math.max(0, balances.reduce((s: number, b: any) => s + (b.paid_amount || 0), 0) - totalExonerated),
    [balances, totalExonerated],
  );
  const { balance: creditBalance } = useFamilyCredits(selectedFamilyId);

  const balancesByStudent = useMemo(() => {
    const map: Record<string, any[]> = {};
    balances.forEach((b: any) => {
      if (!map[b.student_id]) map[b.student_id] = [];
      map[b.student_id].push(b);
    });
    return map;
  }, [balances]);

  // Nombre a mostrar para un pago: familia o hijo según el tipo
  const paymentDisplayName = (payment: any) => {
    if (!payment.family_id && payment.student_id) return studentNameMap[payment.student_id] || "Estudiante";
    const names = [...new Set((payment.payment_items || []).map((it: any) => studentNameMap[it.student_id]).filter(Boolean))];
    return names.length > 0 ? names.join(" / ") : `Familia ${familyName(selectedFamily)}`;
  };

  const handlePrintOverlay = (payment: any) => {
    if (!activeTemplate) {
      toast({ title: "Sin plantilla activa", description: "Configura y activa una plantilla de factura en Configuración > Formato de Factura.", variant: "destructive" });
      return;
    }
    // Un bloque por hijo: la factura familiar cubre a varios y cada uno lleva su grado y sección
    const studentIds = [...new Set([
      ...(payment.student_id ? [payment.student_id] : []),
      ...(payment.payment_items || []).map((it: any) => it.student_id).filter(Boolean),
    ])] as string[];
    const students = studentIds.map((id) => ({
      name: studentNameMap[id] || "",
      gradeLevel: enrollmentByStudent[id]?.sections?.grade_level || "",
      sectionName: enrollmentByStudent[id]?.sections?.name || "",
    }));
    const first = students[0];
    const data = buildInvoiceData(
      payment,
      paymentDisplayName(payment),
      first?.gradeLevel || "",
      first?.sectionName || "",
      methodLabel,
      students,
    );
    printInvoiceOverlay(activeTemplate, data);
  };

  // Anular pago: revierte el saldo del hijo correspondiente a cada item
  const voidMut = useMutation({
    mutationFn: async () => {
      if (!voidReason.trim()) throw new Error("El motivo es obligatorio");
      const { error } = await supabase.from("payments").update({
        status: "voided",
        void_reason: voidReason.trim(),
        voided_at: new Date().toISOString(),
        voided_by: user!.id,
      }).eq("id", voidPaymentId!);
      if (error) throw error;

      const payment = payments.find((p: any) => p.id === voidPaymentId);
      if (payment?.payment_items) {
        for (const item of payment.payment_items) {
          const balanceStudentId = item.student_id ?? payment.student_id;
          if (!balanceStudentId) continue;
          const bal = balances.find((b: any) => b.student_id === balanceStudentId && b.plan_concept_id === item.plan_concept_id);
          if (bal) {
            // Se devuelve la cobertura completa: efectivo + descuento ad-hoc de esa línea
            const newPaid = Math.max(0, (bal.paid_amount || 0) - itemCoverageVes(item));
            const newBalance = (bal.total_amount || 0) - newPaid;
            await supabase.from("student_concept_balances").update({
              paid_amount: newPaid,
              balance: newBalance,
              status: newPaid <= 0 ? "pending" : newBalance <= 0 ? "paid" : "partial",
            }).eq("id", bal.id);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-payments-ledger"] });
      qc.invalidateQueries({ queryKey: ["family-balances-ledger"] });
      toast({ title: "Pago anulado" });
      setVoidOpen(false);
      setVoidReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  // Recibo propio del sistema (distinto de la factura impresa sobre el formato de /formatos)
  const generateReceipt = (payment: any) =>
    downloadPaymentReceiptPdf(payment, {
      headerName: paymentDisplayName(payment),
      headerLabel: "Estudiante(s)",
      subtitle: `Familia: ${familyName(selectedFamily)}`,
      methodLabel,
      studentNameById: studentNameMap,
    });

  if (!selectedFamilyId) {
    return (
      <>
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar familia o estudiante..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            {isLoading ? <div className="space-y-3 my-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
              <Table>
                <TableHeader><TableRow><TableHead>Familia</TableHead><TableHead>Estudiantes</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredFamilies.map((f: any) => (
                    <TableRow key={f.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedFamilyId(f.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{familyName(f)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {(childrenByFamily[f.id] || []).map((c) => (
                            <Badge key={c.student.id} variant="outline" className="text-xs">
                              {studentFullName(c.student)} · {c.enrollment ? `${formatGradeLevel(c.enrollment.sections?.grade_level)}${c.enrollment.sections?.name ? ` - ${c.enrollment.sections.name}` : ""}` : "No inscrito"}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                  {filteredFamilies.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No se encontraron familias</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" className="mb-4" onClick={() => setSelectedFamilyId(null)}>← Volver</Button>

      {/* Family summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Familia</p><p className="font-bold">{familyName(selectedFamily)}</p><p className="text-xs text-muted-foreground mt-1">{familyChildren.length} estudiante(s)</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Cargos</p><p className="font-bold">{totalCharges.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Pagado</p><p className="font-bold text-green-600">{totalPaid.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saldo Pendiente</p><p className={`font-bold ${totalDebt > 0 ? "text-destructive" : "text-green-600"}`}>{totalDebt.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saldo a Favor</p><p className={`font-bold ${creditBalance > 0.01 ? "text-blue-600" : ""}`}>{creditBalance.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></CardContent></Card>
      </div>

      {/* Concept Balances grouped by child */}
      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">Saldos por Concepto</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Total</TableHead><TableHead>Pagado</TableHead><TableHead>Pendiente</TableHead><TableHead>Estado</TableHead><TableHead>Exoneración</TableHead></TableRow></TableHeader>
            <TableBody>
              {familyChildren.map((c) => {
                const sid = c.student?.id;
                const childBalances = balancesByStudent[sid] || [];
                return [
                  <TableRow key={`header-${sid}`} className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={6}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{studentFullName(c.student)}</span>
                        <Badge variant="outline" className="text-xs">{c.enrollment ? `${formatGradeLevel(c.enrollment.sections?.grade_level)}${c.enrollment.sections?.name ? ` - ${c.enrollment.sections.name}` : ""}` : "No inscrito"}</Badge>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(childBalances.length === 0 ? [
                    <TableRow key={`empty-${sid}`}>
                      <TableCell colSpan={6} className="text-xs text-muted-foreground py-2">Sin saldos registrados — verifique que tenga un plan de pago asignado.</TableCell>
                    </TableRow>,
                  ] : childBalances.map((b: any) => {
                    const exoneration = exonerationByBalance[b.id] || null;
                    return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{(b.payment_plan_concepts as any)?.payment_concepts?.name || "—"}</TableCell>
                      <TableCell>{b.total_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{b.paid_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="font-medium">{b.balance?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={conceptStatusVariant(b.status)}>{conceptStatusLabel(b.status)}</Badge></TableCell>
                      <TableCell>
                        {/* La exoneración se aplica al registrar el pago; aquí solo se ve y se puede quitar */}
                        <ExonerateConceptCell
                          conceptName={(b.payment_plan_concepts as any)?.payment_concepts?.name || "esta cuota"}
                          pendingVes={Number(b.balance) || 0}
                          exoneration={exoneration}
                          isPending={revert.isPending}
                          readOnly
                          onClear={() => revert.mutate({ exoneration: exoneration!, balance: b })}
                        />
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

      {/* Payment History */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Historial de Pagos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Tipo</TableHead><TableHead>Total (VES)</TableHead><TableHead>Conceptos</TableHead><TableHead>Métodos</TableHead><TableHead>Estado</TableHead><TableHead className="w-32">Acciones</TableHead></TableRow></TableHeader>
            <TableBody>
              {payments.map((p: any) => (
                <TableRow key={p.id} className={p.status === "voided" ? "opacity-50" : ""}>
                  <TableCell>{formatDateOnly(p.payment_date)}</TableCell>
                  <TableCell>
                    {p.family_id ? (
                      <Badge variant="secondary" className="text-xs gap-1"><Users className="h-3 w-3" />Familiar</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">{studentNameMap[p.student_id] || "Estudiante"}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.total_amount_ves?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.payment_items || []).map((item: any, i: number) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={`text-xs${Number(item.discount_amount_ves) > 0 ? " border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : ""}`}
                          title={Number(item.discount_amount_ves) > 0 ? `Descuento: ${item.discount_reason || ""}` : undefined}
                        >
                          {(item.payment_plan_concepts as any)?.payment_concepts?.name || "?"}
                          {item.student_id && studentNameMap[item.student_id] ? ` · ${(studentNameMap[item.student_id] || "").split(" ")[0]}` : ""}
                          {Number(item.discount_amount_ves) > 0 && ` −${Number(item.discount_amount_ves).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.payment_method_entries || []).map((m: any, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{methodLabel(m.method)} ({m.currency})</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "completed" ? "default" : "destructive"}>
                      {p.status === "completed" ? "Completado" : "Anulado"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => generateReceipt(p)} title="Descargar recibo PDF"><Download className="h-4 w-4" /></Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handlePrintOverlay(p)}
                        title={activeTemplate ? `Imprimir en factura física (${activeTemplate.name})` : "Imprimir (configura una plantilla primero)"}
                      >
                        <Printer className={`h-4 w-4 ${activeTemplate ? "text-blue-600" : "text-muted-foreground"}`} />
                      </Button>
                      {p.status === "completed" && (
                        <Button size="icon" variant="ghost" onClick={() => { setVoidPaymentId(p.id); setVoidOpen(true); }} title="Anular pago"><Ban className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin pagos registrados</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Void Dialog */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Anular Pago</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Esta acción revertirá los saldos afectados de cada estudiante. Ingrese el motivo de la anulación:</p>
            <div className="space-y-1"><Label>Motivo *</Label><Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => voidMut.mutate()} disabled={voidMut.isPending}>
              {voidMut.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}Anular Pago
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
