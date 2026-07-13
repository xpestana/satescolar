import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CreditCard, AlertTriangle, History, Users, Loader2 } from "lucide-react";
import { formatGradeLevel } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Pagination } from "@/components/ui/data-pagination";
import { FamilyPaymentFormModal, type FamilyChildRow } from "@/components/payments/FamilyPaymentFormModal";
import { FamilyPaymentHistoryModal } from "@/components/payments/FamilyPaymentHistoryModal";

interface Props {
  schoolId: string;
  activeYear: any;
}

interface FamilyRow {
  family: any;
  email: string;
  children: FamilyChildRow[];
  pending: number;
  hasAnyPlan: boolean;
}

const PAGE_SIZE = 20;

const studentFullName = (student: any) => {
  const fd = student?.form_data as any;
  return [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ") || "Sin nombre";
};

export function FamilyPaymentRegistrationTab({ schoolId, activeYear }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentFamily, setPaymentFamily] = useState<FamilyRow | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [historyFamily, setHistoryFamily] = useState<FamilyRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Asignación de plan por estudiante
  const [planOpen, setPlanOpen] = useState(false);
  const [planChild, setPlanChild] = useState<FamilyChildRow | null>(null);
  const [planId, setPlanId] = useState("");

  // Estudiantes activos/suspendidos del colegio (inscritos o no).
  // Egresados/culminados quedan excluidos junto con sus cuotas.
  const { data: schoolStudents = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["family-reg-students", schoolId],
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
        .select("id, document_id, form_data, family_id, photo_url, status")
        .in("id", ids)
        .in("status", ["active", "suspended"]);
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Inscripciones del año activo (para mostrar grado/sección si está inscrito)
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["family-reg-enrollments", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments")
        .select("*, sections(id, name, grade_level)")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Familias de los estudiantes activos/suspendidos
  const familyIds = useMemo(
    () => [...new Set(schoolStudents.map((s: any) => s.family_id).filter(Boolean))] as string[],
    [schoolStudents],
  );

  const { data: families = [], isLoading: familiesLoading } = useQuery({
    queryKey: ["families-payment-registration", schoolId, familyIds],
    queryFn: async () => {
      const { data, error } = await supabase.from("families")
        .select("id, user_id, father_last_name, mother_last_name, contact_phone, is_suspended")
        .in("id", familyIds);
      if (error) throw error;
      return data || [];
    },
    enabled: familyIds.length > 0,
  });

  // Planes y saldos por estudiante (mismas keys que el modo por estudiante)
  const { data: studentPlans = [] } = useQuery({
    queryKey: ["all-student-plans", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_payment_plans")
        .select("*, payment_plans(name)")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id)
        .order("assigned_at", { ascending: false })
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  const { data: allBalances = [] } = useQuery({
    queryKey: ["all-student-balances", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data } = await supabase.from("student_concept_balances")
        .select("student_id, balance, status")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id);
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
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
      map[b.student_id] = (map[b.student_id] || 0) + (b.balance || 0);
    });
    return map;
  }, [allBalances]);

  // Planes disponibles para asignación
  const { data: availablePlans = [] } = useQuery({
    queryKey: ["available-plans", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("payment_plans")
        .select("id, name, description")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    enabled: !!schoolId,
  });

  const invalidatePlans = () => {
    qc.invalidateQueries({ queryKey: ["all-student-plans"] });
    qc.invalidateQueries({ queryKey: ["all-student-balances"] });
    qc.invalidateQueries({ queryKey: ["family-students-balances"] });
  };

  const assignPlanMut = useMutation({
    mutationFn: async () => {
      if (!planChild?.student?.id || !planId || !activeYear?.id) throw new Error("Datos incompletos");
      const currentPlan = planMap[planChild.student.id];
      if (currentPlan) {
        if (currentPlan.plan_id === planId) return;
        const { error } = await supabase
          .from("student_payment_plans")
          .update({ plan_id: planId, assigned_at: new Date().toISOString() })
          .eq("id", currentPlan.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("student_payment_plans")
        .insert({
          student_id: planChild.student.id,
          plan_id: planId,
          school_id: schoolId,
          school_year_id: activeYear.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePlans();
      toast({ title: planMap[planChild?.student?.id || ""] ? "Plan actualizado exitosamente" : "Plan asignado exitosamente" });
      setPlanOpen(false);
      setPlanId("");
      setPlanChild(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removePlanMut = useMutation({
    mutationFn: async () => {
      const currentPlan = planMap[planChild?.student?.id || ""];
      if (!currentPlan) return;
      const { error } = await supabase
        .from("student_payment_plans")
        .delete()
        .eq("id", currentPlan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidatePlans();
      toast({ title: "Plan retirado", description: "Los pagos registrados se conservaron en el historial." });
      setPlanOpen(false);
      setPlanId("");
      setPlanChild(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openPlanDialog = (child: FamilyChildRow) => {
    setPlanChild(child);
    setPlanId(planMap[child.student?.id]?.plan_id || "");
    setPlanOpen(true);
  };

  // Filas: una por familia con hijos activos/suspendidos (inscritos o no)
  const allRows: FamilyRow[] = useMemo(() => {
    const enrollmentByStudent: Record<string, any> = {};
    enrollments.forEach((e: any) => { enrollmentByStudent[e.student_id] = e; });
    const byFamily: Record<string, any[]> = {};
    schoolStudents.forEach((s: any) => {
      if (!s.family_id) return;
      if (!byFamily[s.family_id]) byFamily[s.family_id] = [];
      byFamily[s.family_id].push(s);
    });
    return families
      .map((f: any) => {
        const childStudents = byFamily[f.id] || [];
        const children: FamilyChildRow[] = childStudents.map((s: any) => ({
          student: s,
          enrollment: enrollmentByStudent[s.id] || null,
          plan: planMap[s.id] || null,
        }));
        const pending = children.reduce((s, c) => s + (balanceMap[c.student?.id] || 0), 0);
        return {
          family: f,
          email: "",
          children,
          pending,
          hasAnyPlan: children.some((c) => !!c.plan),
        };
      })
      .filter((r: FamilyRow) => r.children.length > 0)
      .sort((a: FamilyRow, b: FamilyRow) =>
        `${a.family.father_last_name || ""} ${a.family.mother_last_name || ""}`.localeCompare(
          `${b.family.father_last_name || ""} ${b.family.mother_last_name || ""}`,
        ),
      );
  }, [families, schoolStudents, enrollments, planMap, balanceMap]);

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  useEffect(() => { setCurrentPage(1); }, [search, allRows.length]);

  // Correos: solo para la página visible
  const filtered = useMemo(() => {
    if (!search.trim()) return allRows;
    const q = normalize(search);
    return allRows.filter((r) => {
      const famName = `${r.family.father_last_name || ""} ${r.family.mother_last_name || ""}`;
      if (normalize(famName).includes(q)) return true;
      return r.children.some((c) =>
        normalize(studentFullName(c.student)).includes(q) || normalize(c.student?.document_id || "").includes(q));
    });
  }, [allRows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const visibleUserIds = useMemo(
    () => paginated.map((r) => r.family.user_id).filter(Boolean),
    [paginated],
  );

  const { data: emails = {} } = useQuery({
    queryKey: ["family-emails", visibleUserIds],
    queryFn: async () => {
      const res = await supabase.functions.invoke("get-user-emails", { body: { userIds: visibleUserIds } });
      return (res.data?.emails || {}) as Record<string, string>;
    },
    enabled: visibleUserIds.length > 0,
  });

  const isLoading = studentsLoading || enrollmentsLoading || familiesLoading;

  const familyName = (f: any) => [f?.father_last_name, f?.mother_last_name].filter(Boolean).join(" ") || "Sin apellidos";

  return (
    <>
      {/* Search */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por apellidos de familia, estudiante o cédula..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Families Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 py-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Familia</TableHead>
                  <TableHead>Estudiantes</TableHead>
                  <TableHead>Saldo Pendiente</TableHead>
                  <TableHead className="w-48">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((row) => (
                  <TableRow key={row.family.id}>
                    <TableCell className="align-top">
                      <div className="flex items-start gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium leading-tight">{familyName(row.family)}</p>
                          <p className="text-xs text-muted-foreground">{emails[row.family.user_id] || "—"}</p>
                          {row.family.is_suspended && <Badge variant="destructive" className="text-[10px] mt-1">Familia suspendida</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-1.5">
                        {row.children.map((c) => (
                          <div key={c.student.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                            <span className="font-medium">{studentFullName(c.student)}</span>
                            {c.enrollment ? (
                              <Badge variant="outline" className="text-[10px]">
                                {formatGradeLevel(c.enrollment?.sections?.grade_level)}{c.enrollment?.sections?.name ? ` - ${c.enrollment.sections.name}` : ""}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">No inscrito</Badge>
                            )}
                            <Badge variant={c.student?.status === "active" ? "secondary" : "destructive"} className="text-[10px]">
                              {c.student?.status === "active" ? "Activo" : c.student?.status === "suspended" ? "Suspendido" : c.student?.status || "—"}
                            </Badge>
                            {c.plan ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] cursor-pointer hover:bg-muted"
                                title="Cambiar plan de pago"
                                onClick={() => openPlanDialog(c)}
                              >
                                {c.plan?.payment_plans?.name || "Plan"}
                              </Badge>
                            ) : (
                              <Badge
                                variant="destructive"
                                className="text-[10px] cursor-pointer hover:opacity-80"
                                title="Asignar plan de pago"
                                onClick={() => openPlanDialog(c)}
                              >
                                Sin plan
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      {row.pending > 0 ? (
                        <span className="text-destructive font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />{row.pending.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
                        </span>
                      ) : (
                        <span className="text-green-600 font-medium">Al día</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => { setPaymentFamily(row); setPaymentOpen(true); }}
                          disabled={!row.hasAnyPlan}
                          title={row.hasAnyPlan ? "Registrar pago familiar" : "Ningún estudiante de esta familia tiene plan de pago asignado"}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />Pago
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          title="Historial de pagos de la familia"
                          onClick={() => { setHistoryFamily(row); setHistoryOpen(true); }}
                        >
                          <History className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No se encontraron familias con estudiantes activos</TableCell></TableRow>
                )}
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

      {/* Family Payment Modal */}
      {paymentFamily && activeYear && (
        <FamilyPaymentFormModal
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          family={{ ...paymentFamily.family, email: emails[paymentFamily.family.user_id] || "" }}
          familyStudents={paymentFamily.children}
          schoolId={schoolId}
          schoolYearId={activeYear.id}
        />
      )}

      {/* Family Payment History Modal */}
      {historyFamily && activeYear && (
        <FamilyPaymentHistoryModal
          open={historyOpen}
          onOpenChange={setHistoryOpen}
          familyId={historyFamily.family.id}
          familyName={familyName(historyFamily.family)}
          studentIds={historyFamily.children.map((c) => c.student.id)}
          studentNames={Object.fromEntries(historyFamily.children.map((c) => [c.student.id, studentFullName(c.student)]))}
          schoolId={schoolId}
          schoolYearId={activeYear.id}
        />
      )}

      {/* Assign Plan Dialog */}
      <Dialog open={planOpen} onOpenChange={(v) => { if (!v) { setPlanOpen(false); setPlanId(""); setPlanChild(null); } else setPlanOpen(v); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{planMap[planChild?.student?.id || ""] ? "Cambiar Plan de Pago" : "Asignar Plan de Pago"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Estudiante: </span>
              <span className="font-medium">{planChild ? studentFullName(planChild.student) : ""}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Seleccione el plan de pago para este estudiante. Si cambia o retira el plan, los pagos ya registrados se conservarán en el historial.
            </p>
            {planMap[planChild?.student?.id || ""] && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <span className="text-muted-foreground">Plan actual: </span>
                <span className="font-medium">{planMap[planChild?.student?.id || ""]?.payment_plans?.name || "—"}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Plan de Pago *</Label>
              <Select value={planId} onValueChange={setPlanId}>
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
            {planMap[planChild?.student?.id || ""] && (
              <Button
                variant="destructive"
                onClick={() => removePlanMut.mutate()}
                disabled={removePlanMut.isPending || assignPlanMut.isPending}
              >
                {removePlanMut.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
                Dejar sin plan
              </Button>
            )}
            <Button variant="outline" onClick={() => setPlanOpen(false)}>Cancelar</Button>
            <Button onClick={() => assignPlanMut.mutate()} disabled={!planId || assignPlanMut.isPending}>
              {assignPlanMut.isPending && <Loader2 className="animate-spin h-4 w-4 mr-1" />}
              {planMap[planChild?.student?.id || ""] ? "Guardar cambio" : "Asignar Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
