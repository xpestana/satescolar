import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSchoolId } from "@/hooks/useSchoolId";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, AlertTriangle, Mail, Download } from "lucide-react";
import { downloadPDF, downloadExcel } from "@/lib/export-utils";

function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export default function DelinquentStudents() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");

  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("*").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: delinqConfig } = useQuery({
    queryKey: ["delinquency-config", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("delinquency_config").select("*").eq("school_id", schoolId!).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const { data: morosos = [], isLoading } = useQuery({
    queryKey: ["delinquent-students", schoolId, activeYear?.id],
    queryFn: async () => {
      if (!activeYear) return [];

      // Get all balances with overdue or partial status
      const { data: balances } = await supabase
        .from("student_concept_balances")
        .select("*, payment_plan_concepts(*, payment_concepts(name))")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear.id)
        .gt("balance", 0);

      if (!balances || balances.length === 0) return [];

      const studentIds = [...new Set(balances.map((b: any) => b.student_id))];

      // Get student info with enrollments
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student_id, sections(name, grade_level), students(id, form_data, family_id)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear.id)
        .in("student_id", studentIds);

      // Get family emails
      const familyIds = [...new Set((enrollments || []).map((e: any) => e.students?.family_id).filter(Boolean))];
      const { data: families } = await supabase.from("families").select("id, user_id").in("id", familyIds);

      // Get reps for primary contact
      const { data: reps } = await supabase.from("representatives").select("family_id, form_data").in("family_id", familyIds).eq("is_primary", true);

      // Get student payment plans
      const { data: spp } = await supabase
        .from("student_payment_plans")
        .select("student_id, payment_plans(name)")
        .eq("school_year_id", activeYear.id)
        .in("student_id", studentIds);

      // Get last notification
      const { data: notifs } = await supabase
        .from("delinquency_notifications")
        .select("student_id, sent_at, status")
        .eq("school_id", schoolId!)
        .in("student_id", studentIds)
        .order("sent_at", { ascending: false });

      const enrollMap = new Map((enrollments || []).map((e: any) => [e.student_id, e]));
      const repMap = new Map((reps || []).map((r: any) => [r.family_id, r]));
      const planMap = new Map((spp || []).map((s: any) => [s.student_id, s]));
      const notifMap = new Map<string, any>();
      (notifs || []).forEach((n: any) => { if (!notifMap.has(n.student_id)) notifMap.set(n.student_id, n); });

      // Group balances by student
      const studentBalances = new Map<string, any[]>();
      balances.forEach((b: any) => {
        const arr = studentBalances.get(b.student_id) || [];
        arr.push(b);
        studentBalances.set(b.student_id, arr);
      });

      return studentIds.map(sid => {
        const enr = enrollMap.get(sid);
        const fd = (enr?.students?.form_data as any) || {};
        const plan = planMap.get(sid);
        const rep = repMap.get(enr?.students?.family_id);
        const repFd = (rep?.form_data as any) || {};
        const lastNotif = notifMap.get(sid);
        const bals = studentBalances.get(sid) || [];
        const totalDebt = bals.reduce((s: number, b: any) => s + Number(b.balance), 0);
        const concepts = bals.map((b: any) => b.payment_plan_concepts?.payment_concepts?.name || "—").join(", ");

        return {
          id: sid,
          firstName: `${fd.primer_nombre || ""} ${fd.segundo_nombre || ""}`.trim(),
          lastName: `${fd.primer_apellido || ""} ${fd.segundo_apellido || ""}`.trim(),
          gradeLevel: (enr?.sections as any)?.grade_level || "",
          section: (enr?.sections as any)?.name || "",
          planName: (plan as any)?.payment_plans?.name || "—",
          repName: `${repFd.primer_nombre || ""} ${repFd.primer_apellido || ""}`.trim(),
          totalDebt,
          concepts,
          conceptCount: bals.length,
          lastReminder: lastNotif?.sent_at ? new Date(lastNotif.sent_at).toLocaleDateString("es-VE") : "Nunca",
          familyId: enr?.students?.family_id,
        };
      }).sort((a, b) => b.totalDebt - a.totalDebt);
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  const filtered = useMemo(() => {
    let result = morosos;
    if (search.trim()) {
      const q = normalize(search);
      result = result.filter((s: any) => normalize(`${s.firstName} ${s.lastName} ${s.repName}`).includes(q));
    }
    if (gradeFilter !== "all") {
      result = result.filter((s: any) => s.gradeLevel === gradeFilter);
    }
    return result;
  }, [morosos, search, gradeFilter]);

  const grades = useMemo(() => [...new Set(morosos.map((m: any) => m.gradeLevel))].sort(), [morosos]);

  const exportCols = [
    { key: "alumno", label: "Alumno" }, { key: "grado", label: "Grado" }, { key: "seccion", label: "Sección" },
    { key: "plan", label: "Plan" }, { key: "rep", label: "Representante" }, { key: "deuda", label: "Deuda (Bs.)" },
    { key: "conceptos", label: "Conceptos" }, { key: "reminder", label: "Último Recordatorio" },
  ];
  const exportRows = filtered.map((s: any) => ({
    alumno: `${s.firstName} ${s.lastName}`, grado: s.gradeLevel, seccion: s.section, plan: s.planName, rep: s.repName,
    deuda: `Bs. ${s.totalDebt.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`, conceptos: s.concepts, reminder: s.lastReminder,
  }));

  const handleExportPDF = () => { downloadPDF(exportCols, exportRows, "Reporte de Morosos"); };
  const handleExportExcel = () => { downloadExcel(exportCols, exportRows, "Morosos"); };

  if (schoolLoading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;

  const totalDeuda = filtered.reduce((s: number, m: any) => s + m.totalDebt, 0);

  return (
    <DashboardLayout>
      <PageHeader title="Morosos" breadcrumbs={[{ label: "Pagos" }, { label: "Morosos" }]} />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold text-destructive">{filtered.length}</div><p className="text-sm text-muted-foreground">Alumnos morosos</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">Bs. {totalDeuda.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</div><p className="text-sm text-muted-foreground">Deuda total acumulada</p></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-2xl font-bold">{delinqConfig?.overdue_after_day || "—"}</div><p className="text-sm text-muted-foreground">Día de corte de mora</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por alumno o representante..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Grado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los grados</SelectItem>
                {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportPDF}><Download className="h-4 w-4 mr-1" />PDF</Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}><Download className="h-4 w-4 mr-1" />Excel</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Representante</TableHead>
                  <TableHead className="text-right">Deuda (Bs.)</TableHead>
                  <TableHead>Conceptos Pendientes</TableHead>
                  <TableHead>Último Recordatorio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.firstName} {m.lastName}</TableCell>
                    <TableCell>{m.gradeLevel}</TableCell>
                    <TableCell>{m.section}</TableCell>
                    <TableCell><Badge variant="secondary">{m.planName}</Badge></TableCell>
                    <TableCell>{m.repName || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">Bs. {m.totalDebt.toLocaleString("es-VE", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{m.concepts}</TableCell>
                    <TableCell>{m.lastReminder}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay alumnos morosos</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
