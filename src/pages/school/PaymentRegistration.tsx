import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSkeleton } from "@/components/ui/loading-skeletons";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Search, CreditCard, AlertTriangle, History, Receipt, CalendarDays } from "lucide-react";
import { ExchangeRateWidget } from "@/components/payments/ExchangeRateWidget";
import { formatGradeLevel } from "@/lib/utils";
import { PaymentFormModal } from "@/components/payments/PaymentFormModal";
import { PaymentHistoryModal } from "@/components/payments/PaymentHistoryModal";
import { PaymentReportsTab } from "@/components/payments/PaymentReportsTab";
import { FamilyPaymentRegistrationTab } from "@/components/payments/FamilyPaymentRegistrationTab";
import { useBillingMode } from "@/hooks/useBillingMode";
import { useToast } from "@/hooks/use-toast";
import { Pagination } from "@/components/ui/data-pagination";

export default function PaymentRegistration() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { billingMode, isLoading: billingModeLoading } = useBillingMode(schoolId);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const mainTab = searchParams.get("tab") === "reportes" ? "reportes" : "registro";
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any>(null);
  const [selectedStudentPlan, setSelectedStudentPlan] = useState<any>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState<{ id: string; name: string } | null>(null);

  // Assign plan state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState<string | null>(null);
  const [assignEnrollment, setAssignEnrollment] = useState<any>(null);
  const [assignPlanId, setAssignPlanId] = useState("");

  // Anos escolares del colegio. Se puede registrar pagos de cualquiera de ellos, no solo del
  // activo: el ledger (student_concept_balances), los planes asignados y los pagos estan todos
  // acotados por school_year_id, asi que cada ano lleva su propia cuenta.
  const { data: schoolYears = [], isLoading: yearsLoading } = useQuery({
    queryKey: ["school-years-all", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("*")
        .eq("school_id", schoolId!)
        .order("year_range", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  const [selectedYearId, setSelectedYearId] = useState("");

  // Arranca en el ano activo (o el mas reciente si ninguno lo esta).
  useEffect(() => {
    if (schoolYears.length === 0) return;
    if (selectedYearId && schoolYears.some((y: any) => y.id === selectedYearId)) return;
    const active = schoolYears.find((y: any) => y.is_active);
    setSelectedYearId(active?.id ?? (schoolYears[0] as any).id);
  }, [schoolYears, selectedYearId]);

  const selectedYear = useMemo(
    () => (schoolYears as any[]).find((y: any) => y.id === selectedYearId) || null,
    [schoolYears, selectedYearId],
  );

  // Al cambiar de ano se cierra todo lo que estuviera abierto: un modal de pago prellenado con
  // las cuotas del ano anterior no debe quedar apuntando al ano nuevo.
  useEffect(() => {
    setPaymentOpen(false);
    setHistoryOpen(false);
    setAssignOpen(false);
    setSelectedStudent(null);
    setSelectedEnrollment(null);
    setSelectedStudentPlan(null);
    setHistoryStudent(null);
    setAssignStudentId(null);
    setAssignEnrollment(null);
    setAssignPlanId("");
    setCurrentPage(1);
  }, [selectedYearId]);

  // Enrollments with student data
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["enrolled-students-payments", schoolId, selectedYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments")
        .select("*, students(id, document_id, form_data, family_id, photo_url), sections(id, name, grade_level)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", selectedYear!.id)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!selectedYear?.id,
  });

  // All non-graduated/completed students for this school (to show unenrolled ones too)
  const { data: allSchoolStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["all-school-students-payments", schoolId],
    queryFn: async () => {
      const { data: ss, error: ssError } = await supabase
        .from("student_schools")
        .select("student_id")
        .eq("school_id", schoolId!);
      if (ssError) throw ssError;
      const ids = ss.map((r: any) => r.student_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("students")
        .select("id, document_id, form_data, family_id, photo_url, status")
        .in("id", ids)
        .in("status", ["active", "suspended"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  const isLoading = enrollmentsLoading || studentsLoading;

  // Student payment plans
  const { data: studentPlans = [] } = useQuery({
    queryKey: ["all-student-plans", schoolId, selectedYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_payment_plans")
        .select("*, payment_plans(name)")
        .eq("school_id", schoolId!)
        .eq("school_year_id", selectedYear!.id)
        .order("assigned_at", { ascending: false })
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!schoolId && !!selectedYear?.id,
  });

  // Student balances for pending amounts
  const { data: allBalances = [] } = useQuery({
    queryKey: ["all-student-balances", schoolId, selectedYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_concept_balances")
        .select("student_id, balance, status")
        .eq("school_id", schoolId!)
        .eq("school_year_id", selectedYear!.id);
      return data || [];
    },
    enabled: !!schoolId && !!selectedYear?.id,
  });

  // Available payment plans for assignment
  const { data: availablePlans = [] } = useQuery({
    queryKey: ["available-plans", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("payment_plans")
        .select("id, name, description")
        .eq("school_id", schoolId!)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!schoolId,
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

  // Pending payment reports count for badge
  const { data: pendingReportsCount = 0 } = useQuery({
    queryKey: ["payment-reports-pending-count", schoolId],
    queryFn: async () => {
      const { count } = await supabase.from("payment_reports")
        .select("id", { count: "exact", head: true })
        .eq("school_id", schoolId!)
        .eq("status", "pending");
      return count || 0;
    },
    enabled: !!schoolId,
    refetchInterval: 60_000,
  });

  const planMap = useMemo(() => {
    const map: Record<string, any> = {};
    studentPlans.forEach((sp: any) => {
      if (!map[sp.student_id]) map[sp.student_id] = sp;
    });
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

  // Build unified rows: enrolled students + unenrolled students
  const allRows = useMemo(() => {
    const enrolledIds = new Set(enrollments.map((e: any) => e.students?.id));
    const unenrolled = allSchoolStudents
      .filter((s: any) => !enrolledIds.has(s.id))
      .map((s: any) => ({ id: `unenrolled-${s.id}`, students: s, sections: null, section_id: null }));
    return [...enrollments, ...unenrolled];
  }, [enrollments, allSchoolStudents]);

  const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  useEffect(() => { setCurrentPage(1); }, [allRows, gradeFilter, sectionFilter, search]);

  const filtered = useMemo(() => {
    let result = allRows;
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
  }, [allRows, gradeFilter, sectionFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Assign plan mutation
  const assignPlanMut = useMutation({
    mutationFn: async () => {
      if (!assignStudentId || !assignPlanId || !selectedYear?.id) throw new Error("Datos incompletos");

      const currentPlan = planMap[assignStudentId];
      if (currentPlan) {
        if (currentPlan.plan_id === assignPlanId) return;

        const { error } = await supabase
          .from("student_payment_plans")
          .update({
            plan_id: assignPlanId,
            assigned_at: new Date().toISOString(),
          })
          .eq("id", currentPlan.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("student_payment_plans")
        .insert({
          student_id: assignStudentId,
          plan_id: assignPlanId,
          school_id: schoolId!,
          school_year_id: selectedYear.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-student-plans"] });
      qc.invalidateQueries({ queryKey: ["all-student-balances"] });
      toast({ title: planMap[assignStudentId || ""] ? "Plan actualizado exitosamente" : "Plan asignado exitosamente" });
      setAssignOpen(false);
      // Open payment modal after assigning
      if (assignEnrollment) {
        setSelectedStudent(assignEnrollment.students);
        setSelectedEnrollment(assignEnrollment);
        setSelectedStudentPlan(null);
        setPaymentOpen(true);
      }
      setAssignPlanId("");
      setAssignStudentId(null);
      setAssignEnrollment(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removePlanMut = useMutation({
    mutationFn: async () => {
      if (!assignStudentId) throw new Error("Seleccione un estudiante");
      const currentPlan = planMap[assignStudentId];
      if (!currentPlan) return;

      const { error } = await supabase
        .from("student_payment_plans")
        .delete()
        .eq("id", currentPlan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-student-plans"] });
      qc.invalidateQueries({ queryKey: ["all-student-balances"] });
      toast({ title: "Plan retirado", description: "Los pagos registrados se conservaron en el historial." });
      setAssignOpen(false);
      setAssignPlanId("");
      setAssignStudentId(null);
      setAssignEnrollment(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handlePayClick = (enrollment: any) => {
    const hasPlan = !!planMap[enrollment.students?.id];
    if (hasPlan) {
      setSelectedStudent(enrollment.students);
      setSelectedEnrollment(enrollment);
      setSelectedStudentPlan(planMap[enrollment.students?.id]);
      setPaymentOpen(true);
    } else {
      // Open assign plan dialog
      setAssignStudentId(enrollment.students?.id);
      setAssignEnrollment(enrollment);
      setAssignPlanId("");
      setAssignOpen(true);
    }
  };

  const handlePlanClick = (enrollment: any) => {
    const currentPlan = planMap[enrollment.students?.id];
    setAssignStudentId(enrollment.students?.id);
    setAssignEnrollment(enrollment);
    setAssignPlanId(currentPlan?.plan_id || "");
    setAssignOpen(true);
  };

  if (schoolLoading || !schoolId) return <DashboardLayout><DashboardSkeleton /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Registro de Pagos" breadcrumbs={[{ label: "Administrativo", href: "/pagos" }, { label: "Registro de Pagos" }]} />

      {/* Main section tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setSearchParams(v === "reportes" ? { tab: "reportes" } : {})} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="registro" className="gap-2">
            <CreditCard className="h-4 w-4" />
            Registro de Pagos
          </TabsTrigger>
          <TabsTrigger value="reportes" className="gap-2">
            <Receipt className="h-4 w-4" />
            Reportes de Representantes
            {pendingReportsCount > 0 && (
              <span className="ml-1 rounded-full bg-orange-500 text-white text-xs font-semibold px-1.5 py-0.5 leading-none">
                {pendingReportsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reportes">
          <PaymentReportsTab />
        </TabsContent>

        <TabsContent value="registro">
      {/* Selector de año escolar: el pago se registra contra el año elegido aquí. */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm text-muted-foreground">Año escolar</Label>
        </div>
        <Select value={selectedYearId} onValueChange={setSelectedYearId} disabled={yearsLoading || schoolYears.length === 0}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder={yearsLoading ? "Cargando..." : "Seleccione un año"} /></SelectTrigger>
          <SelectContent>
            {(schoolYears as any[]).map((y: any) => (
              <SelectItem key={y.id} value={y.id}>
                {y.year_range}{y.is_active ? " (activo)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedYear && !selectedYear.is_active && (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Está registrando pagos del año {selectedYear.year_range}, que no es el año en curso
          </Badge>
        )}
      </div>

      {yearsLoading ? (
        <div className="space-y-3 py-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : schoolYears.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No hay años escolares configurados.</CardContent></Card>
      ) : !selectedYear ? (
        <div className="space-y-3 py-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : billingModeLoading ? (
        <div className="space-y-3 py-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : billingMode === "family" ? (
        <>
          {/* key: al cambiar de año se remonta la pestaña, para no arrastrar una familia
              seleccionada ni un modal abierto contra el año anterior. */}
          <FamilyPaymentRegistrationTab key={selectedYear.id} schoolId={schoolId} selectedYear={selectedYear} />
          <ExchangeRateWidget schoolId={schoolId} />
        </>
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
                {grades.map((g: any) => <SelectItem key={g} value={g}>{formatGradeLevel(g)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sección" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las secciones</SelectItem>
                {sections.filter((s: any) => gradeFilter === "all" || s.grade_level === gradeFilter).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{formatGradeLevel(s.grade_level)} - {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? <div className="space-y-3 py-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div> : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estudiante</TableHead>
                      <TableHead>Cédula</TableHead>
                      <TableHead>Grado</TableHead>
                      <TableHead>Sección</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Saldo Pendiente</TableHead>
                      <TableHead className="w-64">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((e: any) => {
                      const fd = e.students?.form_data as any;
                      const fullName = [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ");
                      const pending = balanceMap[e.students?.id] || 0;
                      const hasPlan = !!planMap[e.students?.id];
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{fullName || "Sin nombre"}</TableCell>
                          <TableCell>{e.students?.document_id || "—"}</TableCell>
                          <TableCell>{formatGradeLevel(e.sections?.grade_level)}</TableCell>
                          <TableCell>{e.sections?.name || "—"}</TableCell>
                          <TableCell className="text-center">
                            {hasPlan ? <Badge variant="outline">{planMap[e.students?.id]?.payment_plans?.name || "—"}</Badge> : <Badge variant="destructive" className="text-xs">Sin plan</Badge>}
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
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => handlePayClick(e)}>
                                <CreditCard className="h-3 w-3 mr-1" />{hasPlan ? "Pagar" : "Asignar"}
                              </Button>
                              {hasPlan && (
                                <Button size="sm" variant="secondary" onClick={() => handlePlanClick(e)}>
                                  Plan
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                title="Historial de pagos"
                                onClick={() => {
                                  setHistoryStudent({ id: e.students.id, name: fullName || "Estudiante" });
                                  setHistoryOpen(true);
                                }}
                              >
                                <History className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No se encontraron estudiantes</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
              {filtered.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={filtered.length}
                  itemsPerPage={PAGE_SIZE}
                />
              )}
            </CardContent>
          </Card>

          {/* Exchange Rate Widget */}
          <ExchangeRateWidget schoolId={schoolId} />

          {/* Assign Plan Dialog */}
          <Dialog open={assignOpen} onOpenChange={(v) => { if (!v) { setAssignOpen(false); setAssignPlanId(""); setAssignStudentId(null); setAssignEnrollment(null); } else setAssignOpen(v); }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{planMap[assignStudentId || ""] ? "Cambiar Plan de Pago" : "Asignar Plan de Pago"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <p className="text-sm text-muted-foreground">
                  Seleccione el plan de pago para este estudiante. Si cambia o retira el plan, los pagos ya registrados se conservarán en el historial.
                </p>
                {planMap[assignStudentId || ""] && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <span className="text-muted-foreground">Plan actual: </span>
                    <span className="font-medium">{planMap[assignStudentId || ""]?.payment_plans?.name || "—"}</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Plan de Pago *</Label>
                  <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                    <SelectTrigger><SelectValue placeholder="Seleccione un plan" /></SelectTrigger>
                    <SelectContent>
                      {availablePlans.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {p.description ? ` — ${p.description}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                {planMap[assignStudentId || ""] && (
                  <Button
                    variant="destructive"
                    onClick={() => removePlanMut.mutate()}
                    disabled={removePlanMut.isPending || assignPlanMut.isPending}
                  >
                    {removePlanMut.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
                    Dejar sin plan
                  </Button>
                )}
                <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
                <Button onClick={() => assignPlanMut.mutate()} disabled={!assignPlanId || assignPlanMut.isPending}>
                  {assignPlanMut.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
                  {planMap[assignStudentId || ""] ? "Guardar cambio" : "Asignar y Continuar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Payment Form Modal */}
          {selectedStudent && selectedEnrollment && selectedYear && (
            <PaymentFormModal
              open={paymentOpen}
              onOpenChange={setPaymentOpen}
              student={selectedStudent}
              enrollment={selectedEnrollment}
              schoolId={schoolId}
              schoolYearId={selectedYear.id}
              initialStudentPlan={selectedStudentPlan}
            />
          )}

          {/* Payment History Modal */}
          {historyStudent && selectedYear && (
            <PaymentHistoryModal
              open={historyOpen}
              onOpenChange={setHistoryOpen}
              studentId={historyStudent.id}
              studentName={historyStudent.name}
              schoolId={schoolId}
              schoolYearId={selectedYear.id}
            />
          )}
        </>
      )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
