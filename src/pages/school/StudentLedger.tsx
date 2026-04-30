import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, FileText, Download, Ban, Eye } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function StudentLedger() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidPaymentId, setVoidPaymentId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("*").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["enrolled-students-ledger", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments")
        .select("*, students(id, document_id, form_data, family_id), sections(name, grade_level)")
        .eq("school_id", schoolId!).eq("school_year_id", activeYear!.id);
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Student payments
  const { data: payments = [] } = useQuery({
    queryKey: ["student-payments-ledger", selectedStudentId, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("payments")
        .select("*, payment_items(*, payment_plan_concepts(payment_concepts(name))), payment_method_entries(*)")
        .eq("student_id", selectedStudentId!)
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id)
        .order("payment_date", { ascending: false });
      return data || [];
    },
    enabled: !!selectedStudentId && !!activeYear?.id,
  });

  const { data: balances = [] } = useQuery({
    queryKey: ["student-balances-ledger", selectedStudentId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_concept_balances")
        .select("*, payment_plan_concepts(payment_concepts(name))")
        .eq("student_id", selectedStudentId!)
        .eq("school_year_id", activeYear!.id)
        .eq("school_id", schoolId!);
      return data || [];
    },
    enabled: !!selectedStudentId && !!activeYear?.id,
  });

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filtered = useMemo(() => {
    if (!search.trim()) return enrollments;
    const q = normalize(search);
    return enrollments.filter((e: any) => {
      const fd = e.students?.form_data as any;
      const name = [fd?.primer_nombre, fd?.primer_apellido].filter(Boolean).join(" ");
      return normalize(name).includes(q) || normalize(e.students?.document_id || "").includes(q);
    });
  }, [enrollments, search]);

  const totalDebt = useMemo(() => balances.reduce((s: number, b: any) => s + (b.balance || 0), 0), [balances]);
  const totalPaid = useMemo(() => balances.reduce((s: number, b: any) => s + (b.paid_amount || 0), 0), [balances]);

  const selectedEnrollment = enrollments.find((e: any) => e.student_id === selectedStudentId);
  const studentFd = selectedEnrollment?.students?.form_data as any;
  const studentName = studentFd ? [studentFd.primer_nombre, studentFd.segundo_nombre, studentFd.primer_apellido, studentFd.segundo_apellido].filter(Boolean).join(" ") : "";

  // Void payment
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

      // Reverse balances
      const payment = payments.find((p: any) => p.id === voidPaymentId);
      if (payment?.payment_items) {
        for (const item of payment.payment_items) {
          const bal = balances.find((b: any) => b.plan_concept_id === item.plan_concept_id);
          if (bal) {
            const newPaid = Math.max(0, (bal.paid_amount || 0) - item.amount_ves);
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
      qc.invalidateQueries({ queryKey: ["student-payments-ledger"] });
      qc.invalidateQueries({ queryKey: ["student-balances-ledger"] });
      toast({ title: "Pago anulado" });
      setVoidOpen(false);
      setVoidReason("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Generate receipt PDF
  const generateReceipt = (payment: any) => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Recibo de Pago", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Estudiante: ${studentName}`, 14, 35);
    doc.text(`Fecha: ${new Date(payment.payment_date).toLocaleDateString("es-VE")}`, 14, 42);
    doc.text(`Estado: ${payment.status === "completed" ? "Completado" : "Anulado"}`, 14, 49);
    if (payment.invoice_name) doc.text(`Facturado a: ${payment.invoice_name} - ${payment.invoice_rif || ""}`, 14, 56);

    const conceptRows = (payment.payment_items || []).map((item: any) => [
      (item.payment_plan_concepts as any)?.payment_concepts?.name || "—",
      `${item.amount_ves?.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES`,
      item.is_partial ? "Parcial" : "Completo",
    ]);
    autoTable(doc, { startY: 65, head: [["Concepto", "Monto", "Tipo"]], body: conceptRows, theme: "grid" });

    const methodRows = (payment.payment_method_entries || []).map((m: any) => [
      m.method, m.currency, m.amount_original?.toLocaleString("es-VE", { minimumFractionDigits: 2 }),
      m.exchange_rate, `${m.amount_ves?.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES`,
      m.reference_code || "—",
    ]);
    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    autoTable(doc, { startY: finalY + 10, head: [["Método", "Moneda", "Monto Orig.", "Tasa", "Monto VES", "Ref."]], body: methodRows, theme: "grid" });

    const finalY2 = (doc as any).lastAutoTable?.finalY || 150;
    doc.setFontSize(12);
    doc.text(`Total: ${payment.total_amount_ves?.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES`, 14, finalY2 + 15);

    doc.save(`recibo_${payment.id.slice(0, 8)}.pdf`);
  };

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Estado de Cuenta" breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Estado de Cuenta" }]} />

      {!selectedStudentId ? (
        <>
          <div className="mb-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar estudiante..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoading ? <div className="space-y-3 my-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Estudiante</TableHead><TableHead>Cédula</TableHead><TableHead>Grado</TableHead><TableHead>Sección</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((e: any) => {
                      const fd = e.students?.form_data as any;
                      const name = [fd?.primer_nombre, fd?.primer_apellido].filter(Boolean).join(" ");
                      return (
                        <TableRow key={e.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStudentId(e.student_id)}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>{e.students?.document_id || "—"}</TableCell>
                          <TableCell>{e.sections?.grade_level}</TableCell>
                          <TableCell>{e.sections?.name}</TableCell>
                          <TableCell><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <Button variant="outline" size="sm" className="mb-4" onClick={() => setSelectedStudentId(null)}>← Volver</Button>

          {/* Student summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Estudiante</p><p className="font-bold">{studentName}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Cargos</p><p className="font-bold">{balances.reduce((s: number, b: any) => s + (b.total_amount || 0), 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Pagado</p><p className="font-bold text-green-600">{totalPaid.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saldo Pendiente</p><p className={`font-bold ${totalDebt > 0 ? "text-destructive" : "text-green-600"}`}>{totalDebt.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p></CardContent></Card>
          </div>

          {/* Concept Balances */}
          <Card className="mb-6">
            <CardHeader><CardTitle className="text-sm">Saldos por Concepto</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Concepto</TableHead><TableHead>Total</TableHead><TableHead>Pagado</TableHead><TableHead>Pendiente</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                <TableBody>
                  {balances.map((b: any) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{(b.payment_plan_concepts as any)?.payment_concepts?.name || "—"}</TableCell>
                      <TableCell>{b.total_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>{b.paid_amount?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="font-medium">{b.balance?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={b.status === "paid" ? "default" : b.status === "partial" ? "secondary" : "outline"}>{b.status === "paid" ? "Pagado" : b.status === "partial" ? "Parcial" : "Pendiente"}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Historial de Pagos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Total (VES)</TableHead><TableHead>Conceptos</TableHead><TableHead>Métodos</TableHead><TableHead>Estado</TableHead><TableHead className="w-24">Acciones</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.map((p: any) => (
                    <TableRow key={p.id} className={p.status === "voided" ? "opacity-50" : ""}>
                      <TableCell>{new Date(p.payment_date).toLocaleDateString("es-VE")}</TableCell>
                      <TableCell className="font-medium">{p.total_amount_ves?.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(p.payment_items || []).map((item: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{(item.payment_plan_concepts as any)?.payment_concepts?.name || "?"}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(p.payment_method_entries || []).map((m: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{m.method} ({m.currency})</Badge>
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
                          <Button size="icon" variant="ghost" onClick={() => generateReceipt(p)} title="Descargar recibo"><Download className="h-4 w-4" /></Button>
                          {p.status === "completed" && (
                            <Button size="icon" variant="ghost" onClick={() => { setVoidPaymentId(p.id); setVoidOpen(true); }} title="Anular pago"><Ban className="h-4 w-4 text-destructive" /></Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin pagos registrados</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Void Dialog */}
          <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Anular Pago</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Esta acción revertirá los saldos afectados. Ingrese el motivo de la anulación:</p>
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
      )}
    </DashboardLayout>
  );
}
