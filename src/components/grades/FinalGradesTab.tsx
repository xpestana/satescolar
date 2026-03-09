import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2, Check, Save } from "lucide-react";
import { toast } from "sonner";

const NUMERIC_GRADES = new Set([
  "media_general", "1_ano", "2_ano", "3_ano", "4_ano", "5_ano",
  "media_tecnica", "6_ano",
]);

interface FinalGradesTabProps {
  schoolId: string;
  effectiveYear: string;
  selectedSubject: string;
  selectedSection: string;
  selectedGcrpAssignment: string;
  selectedSubjectIsGcrp: boolean;
  sections: any[];
  gcrpAssignments: any[];
}

export default function FinalGradesTab({
  schoolId,
  effectiveYear,
  selectedSubject,
  selectedSection,
  selectedGcrpAssignment,
  selectedSubjectIsGcrp,
  sections,
  gcrpAssignments,
}: FinalGradesTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editedGrades, setEditedGrades] = useState<Record<string, string>>({});
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set());
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savingAll, setSavingAll] = useState(false);
  // Track what's actually in DB: key -> grade_value
  const [dbValues, setDbValues] = useState<Record<string, string>>({});

  const filtersComplete = !!effectiveYear && !!selectedSubject && (selectedSubjectIsGcrp ? !!selectedGcrpAssignment : !!selectedSection);

  // Get assignments
  const { data: assignments = [], isLoading: assignmentLoading } = useQuery({
    queryKey: ["final-assignment-lookup", effectiveYear, selectedSubject, selectedSection, selectedGcrpAssignment],
    queryFn: async () => {
      if (selectedSubjectIsGcrp) {
        if (!selectedGcrpAssignment) return [];
        const { data } = await supabase
          .from("subject_teacher_assignments")
          .select("id, section_id, section:section_id(id, grade_level), subject:subject_id(subject_type)")
          .eq("id", selectedGcrpAssignment);
        return data || [];
      } else {
        const { data } = await supabase
          .from("subject_teacher_assignments")
          .select("id, section_id, section:section_id(id, grade_level), subject:subject_id(subject_type)")
          .eq("school_year_id", effectiveYear)
          .eq("subject_id", selectedSubject)
          .eq("school_id", schoolId)
          .eq("section_id", selectedSection);
        return data || [];
      }
    },
    enabled: filtersComplete,
  });

  const assignment = assignments[0] || null;
  const assignmentIds = assignments.map((a: any) => a.id);
  const isGcrpQuery = assignment?.subject?.subject_type === "gcrp";
  const gradeLevel = assignment?.section?.grade_level as string | undefined;
  const isNumeric = isGcrpQuery || (gradeLevel ? NUMERIC_GRADES.has(gradeLevel) : false);

  // Students
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["final-students", selectedSection, effectiveYear, schoolId, isGcrpQuery, assignmentIds],
    queryFn: async () => {
      let rows: any[] = [];
      if (isGcrpQuery && assignmentIds.length > 0) {
        const { data } = await supabase
          .from("gcrp_assignment_students" as any)
          .select("student_id, student:student_id(id, document_id, form_data)")
          .in("assignment_id", assignmentIds);
        rows = data || [];
      } else {
        const { data } = await supabase
          .from("enrollments")
          .select("student_id, student:student_id(id, document_id, form_data)")
          .eq("section_id", selectedSection)
          .eq("school_year_id", effectiveYear)
          .eq("school_id", schoolId);
        rows = data || [];
      }
      return rows.map((e: any) => {
        const fd = e.student?.form_data as Record<string, any> | null;
        const firstName = fd?.nombre || fd?.primer_nombre || "";
        const lastName = fd?.apellido || fd?.primer_apellido || "";
        return {
          student_id: e.student_id,
          student_name: `${lastName} ${firstName}`.trim() || "Sin nombre",
          document_id: e.student?.document_id,
        };
      }).sort((a: any, b: any) => a.student_name.localeCompare(b.student_name));
    },
    enabled: isGcrpQuery ? assignmentIds.length > 0 : (!!selectedSection && !!effectiveYear && !!schoolId),
  });

  // Plan items for ALL 3 momentos
  const { data: allPlanItems = [], isLoading: planLoading } = useQuery({
    queryKey: ["final-all-plan-items", assignmentIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("evaluation_plan_items")
        .select("*")
        .in("assignment_id", assignmentIds)
        .order("momento")
        .order("display_order", { ascending: true });
      return data || [];
    },
    enabled: assignmentIds.length > 0,
  });

  // All grades
  const { data: allGrades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ["final-all-grades", assignmentIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_grades")
        .select("student_id, evaluation_plan_item_id, grade_value")
        .in("assignment_id", assignmentIds);
      return data || [];
    },
    enabled: assignmentIds.length > 0,
  });

  // Existing final grades
  const { data: existingFinalGrades = [], isLoading: finalGradesLoading } = useQuery({
    queryKey: ["existing-final-grades", assignmentIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("final_grades" as any)
        .select("*")
        .in("assignment_id", assignmentIds);
      return (data as any[]) || [];
    },
    enabled: assignmentIds.length > 0,
  });

  // Build grades map
  const gradesMap = useMemo(() => {
    const map: Record<string, string> = {};
    allGrades.forEach((g: any) => {
      map[`${g.student_id}-${g.evaluation_plan_item_id}`] = g.grade_value || "";
    });
    return map;
  }, [allGrades]);

  // Group plan items by momento
  const planByMomento = useMemo(() => {
    const map: Record<number, any[]> = { 1: [], 2: [], 3: [] };
    allPlanItems.forEach((pi: any) => {
      if (map[pi.momento]) map[pi.momento].push(pi);
    });
    return map;
  }, [allPlanItems]);

  // Calculate definitive grade for a student for a momento
  const calculateDefinitive = useCallback((studentId: string, momento: number): string => {
    const items = planByMomento[momento] || [];
    if (items.length === 0) return "";

    const hasPercentages = items.some((pi: any) => pi.percentage != null && pi.percentage > 0);
    const gradeValues: { value: number; percentage: number | null }[] = [];

    for (const pi of items) {
      const val = gradesMap[`${studentId}-${pi.id}`];
      if (!val || val.trim() === "") continue;
      const num = Number(val);
      if (isNaN(num)) continue;
      gradeValues.push({ value: num, percentage: pi.percentage });
    }

    if (gradeValues.length === 0) return "";

    if (hasPercentages) {
      let total = 0;
      for (const gv of gradeValues) {
        total += gv.value * ((gv.percentage || 0) / 100);
      }
      return total.toFixed(2);
    } else {
      const sum = gradeValues.reduce((acc, gv) => acc + gv.value, 0);
      return (sum / gradeValues.length).toFixed(2);
    }
  }, [planByMomento, gradesMap]);

  // Initialize edited grades AND dbValues from existing final grades or calculated values
  useEffect(() => {
    if (!students.length || assignmentIds.length === 0) return;

    const edited: Record<string, string> = {};
    const db: Record<string, string> = {};
    const assignmentId = assignmentIds[0];

    for (const s of students) {
      for (const m of [1, 2, 3]) {
        const key = `${s.student_id}-${m}`;
        const existing = existingFinalGrades.find(
          (fg: any) => fg.student_id === s.student_id && fg.momento === m && fg.assignment_id === assignmentId
        );
        if (existing && existing.grade_value != null) {
          edited[key] = existing.grade_value;
          db[key] = existing.grade_value;
        } else {
          const calc = calculateDefinitive(s.student_id, m);
          edited[key] = calc;
          // Not in DB yet
        }
      }
    }
    setEditedGrades(edited);
    setDbValues(db);
  }, [students, existingFinalGrades, calculateDefinitive, assignmentIds]);

  const handleGradeChange = (studentId: string, momento: number, value: string) => {
    if (isNumeric && value !== "") {
      const num = Number(value);
      if (isNaN(num) || num < 0 || num > 20) return;
    }
    setEditedGrades(prev => ({ ...prev, [`${studentId}-${momento}`]: value }));
  };

  // Check if a key is dirty (differs from DB)
  const isDirty = useCallback((key: string): boolean => {
    const current = (editedGrades[key] || "").trim();
    const saved = (dbValues[key] || "").trim();
    if (current === "" && saved === "") return false;
    return current !== saved;
  }, [editedGrades, dbValues]);

  // Count dirty per momento
  const dirtyCountByMomento = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
    for (const s of students) {
      for (const m of [1, 2, 3]) {
        if (isDirty(`${s.student_id}-${m}`)) counts[m]++;
      }
    }
    return counts;
  }, [students, isDirty]);

  const totalDirty = dirtyCountByMomento[1] + dirtyCountByMomento[2] + dirtyCountByMomento[3];

  const saveGrade = useCallback(async (studentId: string, momento: number) => {
    if (assignmentIds.length === 0) return;
    const key = `${studentId}-${momento}`;
    const val = (editedGrades[key] || "").trim();
    const assignmentId = assignmentIds[0];

    // Skip if not dirty
    if (!isDirty(key)) return;

    setSavingKeys(prev => new Set(prev).add(key));
    try {
      if (val !== "") {
        await supabase
          .from("final_grades" as any)
          .upsert({
            student_id: studentId,
            assignment_id: assignmentId,
            school_id: schoolId,
            momento,
            grade_value: val,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: "student_id,assignment_id,momento" });
        setDbValues(prev => ({ ...prev, [key]: val }));
      } else {
        await supabase
          .from("final_grades" as any)
          .delete()
          .eq("student_id", studentId)
          .eq("assignment_id", assignmentId)
          .eq("momento", momento);
        setDbValues(prev => { const n = { ...prev }; delete n[key]; return n; });
      }
      setSavedKeys(prev => {
        const next = new Set(prev).add(key);
        setTimeout(() => setSavedKeys(p => { const n = new Set(p); n.delete(key); return n; }), 1500);
        return next;
      });
    } catch {
      toast.error("Error al guardar nota definitiva");
    } finally {
      setSavingKeys(prev => { const next = new Set(prev); next.delete(key); return next; });
    }
  }, [assignmentIds, editedGrades, schoolId, isDirty]);

  const saveAll = useCallback(async () => {
    if (assignmentIds.length === 0 || totalDirty === 0) return;
    const assignmentId = assignmentIds[0];
    setSavingAll(true);

    try {
      const upserts: any[] = [];
      const deletes: { studentId: string; momento: number }[] = [];

      for (const s of students) {
        for (const m of [1, 2, 3]) {
          const key = `${s.student_id}-${m}`;
          if (!isDirty(key)) continue;
          const val = (editedGrades[key] || "").trim();
          if (val !== "") {
            upserts.push({
              student_id: s.student_id,
              assignment_id: assignmentId,
              school_id: schoolId,
              momento: m,
              grade_value: val,
              updated_at: new Date().toISOString(),
            });
          } else if (dbValues[key]) {
            deletes.push({ studentId: s.student_id, momento: m });
          }
        }
      }

      // Batch upsert
      if (upserts.length > 0) {
        await supabase
          .from("final_grades" as any)
          .upsert(upserts as any, { onConflict: "student_id,assignment_id,momento" });
      }

      // Delete individually (no batch delete with multiple conditions)
      for (const d of deletes) {
        await supabase
          .from("final_grades" as any)
          .delete()
          .eq("student_id", d.studentId)
          .eq("assignment_id", assignmentId)
          .eq("momento", d.momento);
      }

      // Update dbValues
      setDbValues(prev => {
        const next = { ...prev };
        for (const u of upserts) {
          next[`${u.student_id}-${u.momento}`] = u.grade_value;
        }
        for (const d of deletes) {
          delete next[`${d.studentId}-${d.momento}`];
        }
        return next;
      });

      toast.success(`${upserts.length + deletes.length} notas guardadas correctamente`);
    } catch {
      toast.error("Error al guardar notas");
    } finally {
      setSavingAll(false);
    }
  }, [assignmentIds, students, editedGrades, dbValues, schoolId, isDirty, totalDirty]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter((s: any) =>
      s.student_name.toLowerCase().includes(term) ||
      (s.document_id && s.document_id.toLowerCase().includes(term))
    );
  }, [students, searchTerm]);

  const loading = assignmentLoading || studentsLoading || planLoading || gradesLoading || finalGradesLoading;

  if (!filtersComplete) {
    return (
      <div className="text-center py-12 border rounded-md bg-muted/20">
        <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">
          {selectedSubjectIsGcrp
            ? "Seleccione año escolar, área y docente para ver las notas finales."
            : "Seleccione año escolar, área y sección para ver las notas finales."}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="text-center py-12 border rounded-md bg-muted/20">
        <p className="text-muted-foreground">No se encontró asignación para los filtros seleccionados.</p>
      </div>
    );
  }

  const momentosWithPlan = [1, 2, 3].map(m => ({
    momento: m,
    hasPlan: (planByMomento[m] || []).length > 0,
    hasPercentages: (planByMomento[m] || []).some((pi: any) => pi.percentage != null && pi.percentage > 0),
  }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Badge variant={isNumeric ? "default" : "secondary"}>
            {isNumeric ? "Numérica (1-20)" : "Cualitativa"}
          </Badge>
          <Badge variant="outline">{filteredStudents.length} estudiantes</Badge>
          {savingKeys.size > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Guardando...
            </div>
          )}
          <Button
            size="sm"
            onClick={saveAll}
            disabled={totalDirty === 0 || savingAll}
            className="gap-1.5"
          >
            {savingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Guardar Todos {totalDirty > 0 && `(${totalDirty})`}
          </Button>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estudiante..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10 min-w-[220px]">Nombre del Alumno</TableHead>
              <TableHead className="min-w-[100px]">Cédula</TableHead>
              {momentosWithPlan.map(({ momento, hasPlan, hasPercentages }) => (
                <TableHead key={momento} className="min-w-[130px] text-center">
                  <div>Momento {momento}</div>
                  {hasPlan && (
                    <span className="text-[10px] text-muted-foreground">
                      {hasPercentages ? "Ponderado" : "Promedio"}
                    </span>
                  )}
                  {!hasPlan && (
                    <span className="text-[10px] text-muted-foreground">Sin plan</span>
                  )}
                  {dirtyCountByMomento[momento] > 0 && (
                    <div className="text-[10px] text-orange-500 font-medium">
                      ({dirtyCountByMomento[momento]} sin guardar)
                    </div>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No se encontraron estudiantes.
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((s: any) => (
                <TableRow key={s.student_id}>
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">{s.student_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.document_id || "—"}</TableCell>
                  {[1, 2, 3].map((m) => {
                    const key = `${s.student_id}-${m}`;
                    const isSaving = savingKeys.has(key);
                    const isSaved = savedKeys.has(key);
                    const dirty = isDirty(key);
                    const value = editedGrades[key] || "";
                    return (
                      <TableCell key={m} className="text-center p-1.5">
                        <div className="relative inline-block">
                          <Input
                            type={isNumeric ? "number" : "text"}
                            min={isNumeric ? 0 : undefined}
                            max={isNumeric ? 20 : undefined}
                            value={value}
                            onChange={(e) => handleGradeChange(s.student_id, m, e.target.value)}
                            onBlur={() => saveGrade(s.student_id, m)}
                            className={`h-8 w-20 mx-auto text-center text-sm ${dirty ? "border-orange-400 ring-1 ring-orange-300" : ""}`}
                            placeholder="—"
                          />
                          {dirty && !isSaving && !isSaved && (
                            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-400" />
                          )}
                          {isSaving && (
                            <Loader2 className="absolute top-1.5 right-1 h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                          {isSaved && !isSaving && (
                            <Check className="absolute top-1.5 right-1 h-3 w-3 text-green-500" />
                          )}
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
