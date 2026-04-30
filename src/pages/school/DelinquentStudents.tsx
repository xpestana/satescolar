import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Search, AlertTriangle, Mail, Eye } from "lucide-react";

export default function DelinquentStudents() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("*").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  // All balances with pending amounts
  const { data: pendingBalances = [], isLoading } = useQuery({
    queryKey: ["delinquent-balances", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_concept_balances")
        .select("*, payment_plan_concepts(payment_concepts(name, concept_type), due_day)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id)
        .gt("balance", 0)
        .order("student_id");
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Get enrollments for student info
  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrolled-students-delinquent", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments")
        .select("*, students(id, document_id, form_data, family_id), sections(name, grade_level)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id);
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Families for email
  const studentIds = useMemo(() => [...new Set(pendingBalances.map((b: any) => b.student_id))], [pendingBalances]);

  const { data: families = [] } = useQuery({
    queryKey: ["families-for-delinquent", studentIds],
    queryFn: async () => {
      const famIds = enrollments.filter((e: any) => studentIds.includes(e.student_id)).map((e: any) => e.students?.family_id).filter(Boolean);
      if (famIds.length === 0) return [];
      const { data } = await supabase.from("families").select("id, user_id").in("id", [...new Set(famIds)]);
      return data || [];
    },
    enabled: studentIds.length > 0 && enrollments.length > 0,
  });

  // Notification history
  const { data: notifications = [] } = useQuery({
    queryKey: ["delinquency-notifications", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("delinquency_notifications")
        .select("*")
        .eq("school_id", schoolId!)
        .order("sent_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Aggregate delinquent students
  const delinquentStudents = useMemo(() => {
    const map: Record<string, { studentId: string; totalOwed: number; concepts: any[]; oldestDue: string | null }> = {};
    pendingBalances.forEach((b: any) => {
      if (!map[b.student_id]) map[b.student_id] = { studentId: b.student_id, totalOwed: 0, concepts: [], oldestDue: null };
      map[b.student_id].totalOwed += b.balance;
      map[b.student_id].concepts.push(b);
    });
    return Object.values(map);
  }, [pendingBalances]);

  const enrollmentMap = useMemo(() => {
    const m: Record<string, any> = {};
    enrollments.forEach((e: any) => { m[e.student_id] = e; });
    return m;
  }, [enrollments]);

  const notifMap = useMemo(() => {
    const m: Record<string, any> = {};
    notifications.forEach((n: any) => {
      if (!m[n.student_id] || new Date(n.sent_at) > new Date(m[n.student_id].sent_at)) m[n.student_id] = n;
    });
    return m;
  }, [notifications]);

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filtered = useMemo(() => {
    let result = delinquentStudents;
    if (gradeFilter !== "all") {
      result = result.filter((d) => enrollmentMap[d.studentId]?.sections?.grade_level === gradeFilter);
    }
    if (search.trim()) {
      const q = normalize(search);
      result = result.filter((d) => {
        const e = enrollmentMap[d.studentId];
        const fd = e?.students?.form_data as any;
        const name = [fd?.primer_nombre, fd?.primer_apellido].filter(Boolean).join(" ");
        return normalize(name).includes(q) || normalize(e?.students?.document_id || "").includes(q);
      });
    }
    return result.sort((a, b) => b.totalOwed - a.totalOwed);
  }, [delinquentStudents, gradeFilter, search, enrollmentMap]);

  const grades = useMemo(() => [...new Set(enrollments.map((e: any) => e.sections?.grade_level).filter(Boolean))], [enrollments]);

  const studentNotifs = useMemo(() => {
    if (!selectedStudentId) return [];
    return notifications.filter((n: any) => n.student_id === selectedStudentId);
  }, [selectedStudentId, notifications]);

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Estudiantes Morosos" breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Morosos" }]} />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nombre o cédula..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={gradeFilter} onValueChange={setGradeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Grado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los grados</SelectItem>
            {grades.map((g: any) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6" /></div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estudiante</TableHead>
                  <TableHead>Cédula</TableHead>
                  <TableHead>Grado</TableHead>
                  <TableHead>Sección</TableHead>
                  <TableHead>Conceptos Pendientes</TableHead>
                  <TableHead>Deuda Total (VES)</TableHead>
                  <TableHead>Último Recordatorio</TableHead>
                  <TableHead className="w-20">Historial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => {
                  const e = enrollmentMap[d.studentId];
                  const fd = e?.students?.form_data as any;
                  const name = [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ");
                  const lastNotif = notifMap[d.studentId];
                  return (
                    <TableRow key={d.studentId}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>{e?.students?.document_id || "—"}</TableCell>
                      <TableCell>{e?.sections?.grade_level || "—"}</TableCell>
                      <TableCell>{e?.sections?.name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {d.concepts.slice(0, 3).map((c: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">{(c.payment_plan_concepts as any)?.payment_concepts?.name || "?"}</Badge>
                          ))}
                          {d.concepts.length > 3 && <Badge variant="secondary" className="text-xs">+{d.concepts.length - 3}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-destructive font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />{d.totalOwed.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        {lastNotif ? (
                          <div>
                            <p>{new Date(lastNotif.sent_at).toLocaleDateString("es-VE")}</p>
                            <Badge variant={lastNotif.status === "sent" ? "default" : "destructive"} className="text-[10px]">{lastNotif.status === "sent" ? "Enviado" : "Fallido"}</Badge>
                          </div>
                        ) : <span className="text-muted-foreground">Nunca</span>}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => { setSelectedStudentId(d.studentId); setHistoryOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No hay estudiantes morosos</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Notification History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />Historial de Recordatorios</DialogTitle></DialogHeader>
          {studentNotifs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No se han enviado recordatorios para este estudiante.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {studentNotifs.map((n: any) => (
                <div key={n.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{new Date(n.sent_at).toLocaleString("es-VE")}</span>
                    <Badge variant={n.status === "sent" ? "default" : "destructive"}>{n.status === "sent" ? "Enviado" : "Fallido"}</Badge>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1">A: {n.email_sent_to}</p>
                  <p className="text-xs mt-1">Deuda: {n.total_owed_ves?.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</p>
                  {n.error_message && <p className="text-destructive text-xs mt-1">{n.error_message}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
