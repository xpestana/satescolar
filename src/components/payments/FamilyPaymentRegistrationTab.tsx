import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CreditCard, AlertTriangle, History, Users } from "lucide-react";
import { formatGradeLevel } from "@/lib/utils";
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
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [paymentFamily, setPaymentFamily] = useState<FamilyRow | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [historyFamily, setHistoryFamily] = useState<FamilyRow | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Inscripciones del año activo con datos del estudiante (incluye status y family_id)
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useQuery({
    queryKey: ["family-reg-enrollments", schoolId, activeYear?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments")
        .select("*, students(id, document_id, form_data, family_id, photo_url, status), sections(id, name, grade_level)")
        .eq("school_id", schoolId)
        .eq("school_year_id", activeYear.id)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && !!activeYear?.id,
  });

  // Familias de los estudiantes inscritos
  const familyIds = useMemo(
    () => [...new Set(enrollments.map((e: any) => e.students?.family_id).filter(Boolean))] as string[],
    [enrollments],
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

  // Filas: una por familia con hijos inscritos
  const allRows: FamilyRow[] = useMemo(() => {
    const byFamily: Record<string, any[]> = {};
    enrollments.forEach((e: any) => {
      const fid = e.students?.family_id;
      if (!fid) return;
      if (!byFamily[fid]) byFamily[fid] = [];
      byFamily[fid].push(e);
    });
    return families
      .map((f: any) => {
        const childEnrollments = byFamily[f.id] || [];
        const children: FamilyChildRow[] = childEnrollments.map((e: any) => ({
          student: e.students,
          enrollment: e,
          plan: planMap[e.students?.id] || null,
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
  }, [families, enrollments, planMap, balanceMap]);

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

  const isLoading = enrollmentsLoading || familiesLoading;

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
                  <TableHead>Estudiantes Inscritos</TableHead>
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
                            <Badge variant="outline" className="text-[10px]">
                              {formatGradeLevel(c.enrollment?.sections?.grade_level)}{c.enrollment?.sections?.name ? ` - ${c.enrollment.sections.name}` : ""}
                            </Badge>
                            <Badge variant={c.student?.status === "active" ? "secondary" : "destructive"} className="text-[10px]">
                              {c.student?.status === "active" ? "Activo" : c.student?.status === "suspended" ? "Suspendido" : c.student?.status || "—"}
                            </Badge>
                            {!c.plan && <Badge variant="destructive" className="text-[10px]">Sin plan</Badge>}
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
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No se encontraron familias con estudiantes inscritos</TableCell></TableRow>
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
    </>
  );
}
