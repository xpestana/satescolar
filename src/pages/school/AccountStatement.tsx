import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSchoolId } from "@/hooks/useSchoolId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, FileText, Download, XCircle } from "lucide-react";
import { downloadPDF } from "@/lib/export-utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function AccountStatement() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);

  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("*").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  // Students list
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["account-students", schoolId, activeYear?.id],
    queryFn: async () => {
      if (!activeYear) return [];
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, sections(name, grade_level), students(id, form_data)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear.id);
      return (enrollments || []).map((e: any) => {
        const fd = (e.students?.form_data as any) || {};
        return {
          id: e.student_id,
          firstName: `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""}`.trim(),
          lastName: `${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.trim(),
          document: fd.documento || "",
          gradeLevel: (e.sections as any)?.grade_level || "",
          section: (e.sections as any)?.name || "",
        };
      });
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Balances for selected student
  const { data: balances = [] } = useQuery({
    queryKey: ["account-balances", selectedStudent?.id, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_concept_balances")
        .select("*, payment_plan_concepts(*, payment_concepts(name, concept_type))")
        .eq("student_id", selectedStudent!.id)
        .eq("school_year_id", activeYear!.id)
        .eq("school_id", schoolId!);
      return (data || []).map((b: any) => ({
        concept: b.payment_plan_concepts?.payment_concepts?.name || "—",
        total: Number(b.total_amount),
        paid: Number(b.paid_amount),
        balance: Number(b.balance),
        status: b.status,
      }));
    },
    enabled: !!selectedStudent?.id && !!activeYear?.id,
  });

  // Payments for selected student
  const { data: payments = [] } = useQuery({
    queryKey: ["account-payments", selectedStudent?.id, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, payment_items(*, payment_plan_concepts(payment_concepts(name))), payment_method_entries(*)")
        .eq("student_id", selectedStudent!.id)
        .eq("school_year_id", activeYear!.id)
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedStudent?.id && !!activeYear?.id,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return students;
    const q = normalize(search);
    return students.filter((s: any) => normalize(`${s.firstName} ${s.lastName} ${s.document}`).includes(q));
  }, [students, search]);

  const totalBalance = balances.reduce((s: number, b: any) => s + b.balance, 0);
  const totalPaid = balances.reduce((s: number, b: any) => s + b.paid, 0);

  const generateReceipt = (paymentId: string) => {
    const payment = payments.find((p: any) => p.id === paymentId);
    if (!payment) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Recibo de Pago", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Alumno: ${selectedStudent?.firstName} ${selectedStudent?.lastName}`, 14, 35);
    doc.text(`Fecha: ${new Date(payment.created_at).toLocaleDateString("es-VE")}`, 14, 42);
    doc.text(`RIF/Cédula: ${payment.invoice_rif || "—"}`, 14, 49);
    doc.text(`Nombre: ${payment.invoice_name || "—"}`, 14, 56);
    doc.text(`Estado: ${payment.status === "voided" ? "ANULADO" : "Completado"}`, 14, 63);

    // Concepts table
    const conceptRows = (payment.payment_items || []).map((item: any) => [
      item.payment_plan_concepts?.payment_concepts?.name || "—",
      `Bs. ${Number(item.amount_ves).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
      item.is_partial ? "Parcial" : "Completo",
    ]);
    autoTable(doc, {
      startY: 70,
      head: [["Concepto", "Monto (Bs.)", "Tipo"]],
      body: conceptRows,
    });

    // Methods table
    const methodRows = (payment.payment_method_entries || []).map((m: any) => [
      m.method, m.currency, `${Number(m.amount_original).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
      m.currency !== "VES" ? String(m.exchange_rate) : "—",
      `Bs. ${Number(m.amount_ves).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`,
      m.reference_code || "—",
    ]);

    const finalY = (doc as any).lastAutoTable?.finalY || 100;
    autoTable(doc, {
      startY: finalY + 10,
      head: [["Método", "Moneda", "Monto Original", "Tasa", "Monto Bs.", "Referencia"]],
      body: methodRows,
    });

    const finalY2 = (doc as any).lastAutoTable?.finalY || 140;
    doc.setFontSize(12);
    doc.text(`Total: Bs. ${Number(payment.total_amount_ves).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`, 14, finalY2 + 15);

    doc.save(`Recibo_${selectedStudent?.lastName}_${new Date(payment.created_at).toISOString().slice(0, 10)}.pdf`);
  };

  if (schoolLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "Pendiente", variant: "outline" },
    partial: { label: "Parcial", variant: "secondary" },
    paid: { label: "Pagado", variant: "default" },
    overdue: { label: "Vencido", variant: "destructive" },
  };

  return (
    <DashboardLayout>
      <PageHeader title="Estado de Cuenta" breadcrumbs={[{ label: "Pagos" }, { label: "Estado de Cuenta" }]} />

      {!selectedStudent ? (
        <Card>
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar alumno..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent>
            {studentsLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Alumno</TableHead><TableHead>Cédula</TableHead><TableHead>Grado</TableHead><TableHead>Sección</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((s: any) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStudent(s)}>
                      <TableCell className="font-medium">{s.firstName} {s.lastName}</TableCell>
                      <TableCell>{s.document || "—"}</TableCell>
                      <TableCell>{s.gradeLevel}</TableCell>
                      <TableCell>{s.section}</TableCell>
                      <TableCell><Button variant="outline" size="sm">Ver Estado</Button></TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No se encontraron alumnos</TableCell></TableRow>}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setSelectedStudent(null)}>← Volver al listado</Button>

          {/* Student header */}
          <Card>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><span className="text-xs text-muted-foreground">Alumno</span><p className="font-medium">{selectedStudent.firstName} {selectedStudent.lastName}</p></div>
                <div><span className="text-xs text-muted-foreground">Grado / Sección</span><p className="font-medium">{selectedStudent.gradeLevel} — {selectedStudent.section}</p></div>
                <div><span className="text-xs text-muted-foreground">Total Pagado</span><p className="font-medium text-primary">Bs. {totalPaid.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</p></div>
                <div><span className="text-xs text-muted-foreground">Saldo Pendiente</span><p className={`font-medium ${totalBalance > 0 ? "text-destructive" : "text-primary"}`}>Bs. {totalBalance.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</p></div>
              </div>
            </CardContent>
          </Card>

          {/* Balances */}
          <Card>
            <CardHeader><CardTitle className="text-base">Conceptos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Concepto</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Pagado</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead>Estado</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {balances.map((b: any, i: number) => {
                    const s = statusLabels[b.status] || statusLabels.pending;
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{b.concept}</TableCell>
                        <TableCell className="text-right">Bs. {b.total.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right">Bs. {b.paid.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell className="text-right font-semibold">Bs. {b.balance.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                  {balances.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sin conceptos asignados</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card>
            <CardHeader><CardTitle className="text-base">Historial de Pagos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Fecha</TableHead><TableHead>Conceptos</TableHead><TableHead className="text-right">Total (Bs.)</TableHead><TableHead>Estado</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payments.map((p: any) => (
                    <TableRow key={p.id} className={p.status === "voided" ? "opacity-50" : ""}>
                      <TableCell>{new Date(p.created_at).toLocaleDateString("es-VE")}</TableCell>
                      <TableCell className="max-w-[250px] truncate">
                        {(p.payment_items || []).map((i: any) => i.payment_plan_concepts?.payment_concepts?.name || "—").join(", ")}
                      </TableCell>
                      <TableCell className="text-right font-medium">Bs. {Number(p.total_amount_ves).toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        {p.status === "voided" ? (
                          <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Anulado</Badge>
                        ) : (
                          <Badge variant="default">Completado</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => generateReceipt(p.id)}>
                          <Download className="h-4 w-4 mr-1" />Recibo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Sin pagos registrados</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
}
