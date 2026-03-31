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
import { Loader2, Search, CreditCard, AlertTriangle } from "lucide-react";
import { ExchangeRateWidget } from "@/components/payments/ExchangeRateWidget";
import { PaymentFormModal } from "@/components/payments/PaymentFormModal";

export default function PaymentRegistration() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);

  // Active school year
  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("school_years").select("*").eq("school_id", schoolId!).eq("is_active", true).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  // Enrollments with student data
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ["enrolled-students-payments", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments")
        .select("*, students(id, document_id, form_data, family_id, photo_url), sections(id, name, grade_level)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Student payment plans
  const { data: studentPlans = [] } = useQuery({
    queryKey: ["all-student-plans", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_payment_plans")
        .select("*, payment_plans(name)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id);
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Student balances for pending amounts
  const { data: allBalances = [] } = useQuery({
    queryKey: ["all-student-balances", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_concept_balances")
        .select("student_id, balance, status")
        .eq("school_id", schoolId!)
        .eq("school_year_id", activeYear!.id);
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Sections for filter
  const { data: sections = [] } = useQuery({
    queryKey: ["school-sections", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("sections").select("*").eq("school_id", schoolId!).order("grade_level").order("name");
      return data || [];
    },
    enabled: !!schoolId,
  });

  const planMap = useMemo(() => {
    const map: Record<string, string> = {};
    studentPlans.forEach((sp: any) => { map[sp.student_id] = sp.payment_plans?.name || "—"; });
    return map;
  }, [studentPlans]);

  const balanceMap = useMemo(() => {
    const map: Record<string, number> = {};
    allBalances.forEach((b: any) => {
      if (!map[b.student_id]) map[b.student_id] = 0;
      map[b.student_id] += b.balance || 0;
    });
    return map;
  }, [allBalances]);

  const grades = useMemo(() => [...new Set(sections.map((s: any) => s.grade_level))], [sections]);

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filtered = useMemo(() => {
    let result = enrollments;
    if (gradeFilter !== "all") result = result.filter((e: any) => e.sections?.grade_level === gradeFilter);
    if (sectionFilter !== "all") result = result.filter((e: any) => e.section_id === sectionFilter);
    if (search.trim()) {
      const q = normalize(search);
      result = result.filter((e: any) => {
        const fd = e.students?.form_data as any;
        const fullName = [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ");
        return normalize(fullName).includes(q) || normalize(e.students?.document_id || "").includes(q);
      });
    }
    return result;
  }, [enrollments, gradeFilter, sectionFilter, search]);

  const openPayment = (enrollment: any) => {
    setSelectedStudent(enrollment.students);
    setSelectedEnrollment(enrollment);
    setPaymentOpen(true);
  };

  if (schoolLoading || !schoolId) return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Registro de Pagos" breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Registro de Pagos" }]} />

      {!activeYear ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No hay un año escolar activo configurado.</CardContent></Card>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nombre o cédula..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setSectionFilter("all"); }}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Grado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los grados</SelectItem>
                {grades.map((g: any) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sección" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las secciones</SelectItem>
                {sections.filter((s: any) => gradeFilter === "all" || s.grade_level === gradeFilter).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.grade_level} - {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Table */}
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
                      <TableHead>Plan</TableHead>
                      <TableHead>Saldo Pendiente</TableHead>
                      <TableHead className="w-24">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e: any) => {
                      const fd = e.students?.form_data as any;
                      const fullName = [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ");
                      const pending = balanceMap[e.students?.id] || 0;
                      const hasPlan = !!planMap[e.students?.id];
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{fullName || "Sin nombre"}</TableCell>
                          <TableCell>{e.students?.document_id || "—"}</TableCell>
                          <TableCell>{e.sections?.grade_level || "—"}</TableCell>
                          <TableCell>{e.sections?.name || "—"}</TableCell>
                          <TableCell>
                            {hasPlan ? <Badge variant="outline">{planMap[e.students?.id]}</Badge> : <Badge variant="destructive" className="text-xs">Sin plan</Badge>}
                          </TableCell>
                          <TableCell>
                            {pending > 0 ? (
                              <span className="text-destructive font-medium flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />{pending.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
                              </span>
                            ) : (
                              <span className="text-green-600 font-medium">Al día</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" onClick={() => openPayment(e)} disabled={!hasPlan}>
                              <CreditCard className="h-3 w-3 mr-1" />Pagar
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No se encontraron estudiantes</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Exchange Rate Widget */}
          <ExchangeRateWidget schoolId={schoolId} />

          {/* Payment Form Modal */}
          {selectedStudent && selectedEnrollment && activeYear && (
            <PaymentFormModal
              open={paymentOpen}
              onOpenChange={setPaymentOpen}
              student={selectedStudent}
              enrollment={selectedEnrollment}
              schoolId={schoolId}
              schoolYearId={activeYear.id}
            />
          )}
        </>
      )}
    </DashboardLayout>
  );
}
