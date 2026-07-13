import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TableSkeleton } from "@/components/ui/loading-skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, AlertTriangle, ChevronDown, ChevronRight, Users } from "lucide-react";
import { formatGradeLevel } from "@/lib/utils";
import { familySurname, buildPrimaryRepMap } from "@/lib/familyDisplayName";

interface Props {
  schoolId: string;
  schoolYearId: string;
}

interface DelinquentFamilyRow {
  family_id: string;
  father_last_name: string | null;
  mother_last_name: string | null;
  family_user_id: string | null;
  total_owed: number;
  students: Array<{
    student_id: string;
    total_owed: number;
    concepts: Array<{ plan_concept_id: string; balance: number; name: string; due_day: number | null; due_month: number | null; is_recurring: boolean }>;
  }>;
}

export function DelinquentFamiliesView({ schoolId, schoolYearId }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: delinquentFamilies = [], isLoading, error } = useQuery({
    queryKey: ["delinquent-families-rpc", schoolId, schoolYearId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_delinquent_families", {
        _school_id: schoolId,
        _school_year_id: schoolYearId,
      });
      if (error) throw error;
      return (data || []) as DelinquentFamilyRow[];
    },
    enabled: !!schoolId && !!schoolYearId,
  });

  // Información de los estudiantes morosos (nombre, grado/sección)
  const studentIds = useMemo(
    () => [...new Set(delinquentFamilies.flatMap((f) => (f.students || []).map((s) => s.student_id)))],
    [delinquentFamilies],
  );

  const { data: enrollments = [] } = useQuery({
    queryKey: ["delinquent-families-enrollments", schoolId, schoolYearId, studentIds],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments")
        .select("student_id, students(id, document_id, form_data), sections(name, grade_level)")
        .eq("school_id", schoolId)
        .eq("school_year_id", schoolYearId)
        .in("student_id", studentIds);
      return data || [];
    },
    enabled: studentIds.length > 0,
  });

  const enrollmentMap = useMemo(() => {
    const m: Record<string, any> = {};
    enrollments.forEach((e: any) => { m[e.student_id] = e; });
    return m;
  }, [enrollments]);

  // Datos de los estudiantes morosos (nombre/cédula) — cubre también a los no inscritos,
  // que no aparecen en `enrollments`.
  const { data: studentRecords = [] } = useQuery({
    queryKey: ["delinquent-families-students", schoolId, studentIds],
    queryFn: async () => {
      const { data } = await supabase.from("students")
        .select("id, document_id, form_data")
        .in("id", studentIds);
      return data || [];
    },
    enabled: studentIds.length > 0,
  });

  const studentInfoMap = useMemo(() => {
    const m: Record<string, any> = {};
    studentRecords.forEach((s: any) => { m[s.id] = s; });
    return m;
  }, [studentRecords]);

  // Representantes de las familias morosas (apellido de respaldo desde el principal)
  const familyIds = useMemo(
    () => [...new Set(delinquentFamilies.map((f) => f.family_id).filter(Boolean))],
    [delinquentFamilies],
  );

  const { data: representatives = [] } = useQuery({
    queryKey: ["delinquent-families-reps", schoolId, familyIds],
    queryFn: async () => {
      const { data } = await supabase.from("representatives")
        .select("family_id, is_primary, form_data")
        .in("family_id", familyIds);
      return data || [];
    },
    enabled: familyIds.length > 0,
  });

  const primaryRepByFamily = useMemo(() => buildPrimaryRepMap(representatives as any[]), [representatives]);
  const familyName = (f: DelinquentFamilyRow) => familySurname(f, primaryRepByFamily[f.family_id]);

  const studentName = (studentId: string) => {
    const fd = (studentInfoMap[studentId]?.form_data ?? enrollmentMap[studentId]?.students?.form_data) as any;
    return [fd?.primer_nombre, fd?.segundo_nombre, fd?.primer_apellido, fd?.segundo_apellido].filter(Boolean).join(" ") || "Estudiante";
  };

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  const filtered = useMemo(() => {
    let result = delinquentFamilies;
    if (search.trim()) {
      const q = normalize(search);
      result = result.filter((f) => {
        const famName = familyName(f);
        if (normalize(famName).includes(q)) return true;
        return (f.students || []).some((s) => normalize(studentName(s.student_id)).includes(q));
      });
    }
    return [...result].sort((a, b) => (Number(b.total_owed) || 0) - (Number(a.total_owed) || 0));
  }, [delinquentFamilies, search, enrollmentMap, studentInfoMap, primaryRepByFamily]);

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const totalOwedGlobal = filtered.reduce((s, f) => s + (Number(f.total_owed) || 0), 0);

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por apellidos de familia o estudiante..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {filtered.length > 0 && (
          <Badge variant="outline" className="text-sm">
            {filtered.length} familia(s) · Deuda total: {totalOwedGlobal.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
          </Badge>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Error al cargar familias morosas: {(error as any)?.message || "Error desconocido"}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4"><Table><TableBody><TableSkeleton rows={5} columns={5} /></TableBody></Table></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Familia</TableHead>
                  <TableHead>Estudiantes con Deuda</TableHead>
                  <TableHead>Deuda Total (VES)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => (
                  <Fragment key={f.family_id}>
                    <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggle(f.family_id)}>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-6 w-6">
                          {expanded[f.family_id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-medium">{familyName(f)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          {(f.students || []).map((s) => (
                            <span key={s.student_id} className="text-sm leading-tight">{studentName(s.student_id)}</span>
                          ))}
                          <span className="text-[10px] text-muted-foreground">{(f.students || []).length} estudiante(s) con deuda</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-destructive font-bold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />{(Number(f.total_owed) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                    </TableRow>
                    {expanded[f.family_id] && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={4} className="p-3">
                          <div className="space-y-3">
                            {(f.students || []).map((s) => {
                              const e = enrollmentMap[s.student_id];
                              return (
                                <div key={s.student_id} className="rounded-md border bg-background p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">{studentName(s.student_id)}</span>
                                      <Badge variant="outline" className="text-[10px]">
                                        {formatGradeLevel(e?.sections?.grade_level)}{e?.sections?.name ? ` - ${e.sections.name}` : ""}
                                      </Badge>
                                      {(studentInfoMap[s.student_id]?.document_id || e?.students?.document_id) && (
                                        <span className="text-xs text-muted-foreground">{studentInfoMap[s.student_id]?.document_id || e?.students?.document_id}</span>
                                      )}
                                    </div>
                                    <span className="text-destructive font-semibold text-sm">
                                      {(Number(s.total_owed) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                    {(s.concepts || []).map((c, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">
                                        {c.name} · {(Number(c.balance) || 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay familias morosas</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
