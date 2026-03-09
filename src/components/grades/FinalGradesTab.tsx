import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Loader2, Check, Save, Plus, Minus, Info } from "lucide-react";
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
  const [dbValues, setDbValues] = useState<Record<string, string>>({});
  // Adjustment points: key -> number
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [dbAdjustments, setDbAdjustments] = useState<Record<string, number>>({});
  const [savingAdjKeys, setSavingAdjKeys] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  
  // Refs to always have latest values in callbacks
  const editedGradesRef = useRef(editedGrades);
  editedGradesRef.current = editedGrades;
  const dbValuesRef = useRef(dbValues);
  dbValuesRef.current = dbValues;
  const adjustmentsRef = useRef(adjustments);
  adjustmentsRef.current = adjustments;

  const filtersComplete = !!effectiveYear && !!selectedSubject && (selectedSubjectIsGcrp ? !!selectedGcrpAssignment : !!selectedSection);

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

  const gradesMap = useMemo(() => {
    const map: Record<string, string> = {};
    allGrades.forEach((g: any) => {
      map[`${g.student_id}-${g.evaluation_plan_item_id}`] = g.grade_value || "";
    });
    return map;
  }, [allGrades]);

  const planByMomento = useMemo(() => {
    const map: Record<number, any[]> = { 1: [], 2: [], 3: [] };
    allPlanItems.forEach((pi: any) => {
      if (map[pi.momento]) map[pi.momento].push(pi);
    });
    return map;
  }, [allPlanItems]);

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

  // Reset initialized when filters change
  useEffect(() => {
    setInitialized(false);
  }, [assignmentIds.join(","), students.length]);

  // Initialize edited grades, dbValues, and adjustments — only once per data load
  useEffect(() => {
    if (initialized) return;
    if (!students.length || assignmentIds.length === 0) return;
    if (finalGradesLoading || gradesLoading || planLoading) return;

    const edited: Record<string, string> = {};
    const db: Record<string, string> = {};
    const adj: Record<string, number> = {};
    const dbAdj: Record<string, number> = {};
    const assignmentId = assignmentIds[0];

    for (const s of students) {
      for (const m of [1, 2, 3, 0]) {
        const key = `${s.student_id}-${m}`;
        const existing = existingFinalGrades.find(
          (fg: any) => fg.student_id === s.student_id && fg.momento === m && fg.assignment_id === assignmentId
        );
        if (existing && existing.grade_value != null) {
          edited[key] = existing.grade_value;
          db[key] = existing.grade_value;
          const adjVal = existing.adjustment_points ?? 0;
          adj[key] = Number(adjVal);
          dbAdj[key] = Number(adjVal);
        } else if (m === 0) {
          // Annual average: avg of momentos 1-3, treating empty as 0
          const vals = [1, 2, 3].map(mo => {
            const k = `${s.student_id}-${mo}`;
            const ex = existingFinalGrades.find(
              (fg: any) => fg.student_id === s.student_id && fg.momento === mo && fg.assignment_id === assignmentId
            );
            if (ex && ex.grade_value != null) return Number(ex.grade_value) || 0;
            const calc = calculateDefinitive(s.student_id, mo);
            return calc ? Number(calc) || 0 : 0;
          });
          edited[key] = (vals.reduce((a, b) => a + b, 0) / 3).toFixed(2);
        } else {
          const calc = calculateDefinitive(s.student_id, m);
          edited[key] = calc;
        }
      }
    }
    setEditedGrades(edited);
    setDbValues(db);
    setAdjustments(adj);
    setDbAdjustments(dbAdj);
    setInitialized(true);
  }, [initialized, students, existingFinalGrades, calculateDefinitive, assignmentIds, finalGradesLoading, gradesLoading, planLoading]);

  const handleGradeChange = (studentId: string, momento: number, value: string) => {
    // Allow free typing, validate on blur/save
    setEditedGrades(prev => ({ ...prev, [`${studentId}-${momento}`]: value }));
  };

  const isDirty = useCallback((key: string): boolean => {
    const current = (editedGrades[key] || "").trim();
    const saved = (dbValues[key] || "").trim();
    if (current === "" && saved === "") return false;
    return current !== saved;
  }, [editedGrades, dbValues]);

  const dirtyCountByMomento = useMemo(() => {
    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (const s of students) {
      for (const m of [0, 1, 2, 3]) {
        if (isDirty(`${s.student_id}-${m}`)) counts[m]++;
      }
    }
    return counts;
  }, [students, isDirty]);

  const totalDirty = dirtyCountByMomento[0] + dirtyCountByMomento[1] + dirtyCountByMomento[2] + dirtyCountByMomento[3];

  const saveGrade = useCallback(async (studentId: string, momento: number) => {
    if (assignmentIds.length === 0) return;
    const key = `${studentId}-${momento}`;
    const val = (editedGradesRef.current[key] || "").trim();
    const savedVal = (dbValuesRef.current[key] || "").trim();
    const assignmentId = assignmentIds[0];
    
    // Validate numeric on save
    if (isNumeric && val !== "") {
      const num = Number(val);
      if (isNaN(num) || num < 0 || num > 20) {
        toast.error("La nota debe ser un número entre 0 y 20");
        return;
      }
    }
    
    // Check dirty using refs
    if (val === savedVal) return;

    setSavingKeys(prev => new Set(prev).add(key));
    try {
      if (val !== "") {
        const adjVal = adjustmentsRef.current[key] || 0;
        await supabase
          .from("final_grades" as any)
          .upsert({
            student_id: studentId,
            assignment_id: assignmentId,
            school_id: schoolId,
            momento,
            grade_value: val,
            adjustment_points: adjVal,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: "student_id,assignment_id,momento" });
        setDbValues(prev => ({ ...prev, [key]: val }));
        setDbAdjustments(prev => ({ ...prev, [key]: adjVal }));
      } else {
        await supabase
          .from("final_grades" as any)
          .delete()
          .eq("student_id", studentId)
          .eq("assignment_id", assignmentId)
          .eq("momento", momento);
        setDbValues(prev => { const n = { ...prev }; delete n[key]; return n; });
        setDbAdjustments(prev => { const n = { ...prev }; delete n[key]; return n; });
        setAdjustments(prev => { const n = { ...prev }; delete n[key]; return n; });
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
  }, [assignmentIds, schoolId, isNumeric]);

  // Adjust point: only works on saved grades
  const adjustPoint = useCallback(async (studentId: string, momento: number, delta: number) => {
    if (assignmentIds.length === 0) return;
    const key = `${studentId}-${momento}`;
    const currentGrade = (editedGrades[key] || "").trim();
    if (!currentGrade || !dbValues[key]) return; // Must be saved first

    const gradeNum = Number(currentGrade);
    if (isNaN(gradeNum)) return;

    const newGrade = gradeNum + delta;
    if (newGrade < 0 || newGrade > 20) return;

    const currentAdj = adjustments[key] || 0;
    const newAdj = currentAdj + delta;
    const newGradeStr = Number.isInteger(newGrade) ? String(newGrade) : newGrade.toFixed(2);

    setSavingAdjKeys(prev => new Set(prev).add(key));
    try {
      await supabase
        .from("final_grades" as any)
        .upsert({
          student_id: studentId,
          assignment_id: assignmentIds[0],
          school_id: schoolId,
          momento,
          grade_value: newGradeStr,
          adjustment_points: newAdj,
          updated_at: new Date().toISOString(),
        } as any, { onConflict: "student_id,assignment_id,momento" });

      setEditedGrades(prev => ({ ...prev, [key]: newGradeStr }));
      setDbValues(prev => ({ ...prev, [key]: newGradeStr }));
      setAdjustments(prev => ({ ...prev, [key]: newAdj }));
      setDbAdjustments(prev => ({ ...prev, [key]: newAdj }));
    } catch {
      toast.error("Error al ajustar punto");
    } finally {
      setSavingAdjKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  }, [assignmentIds, editedGrades, dbValues, adjustments, schoolId]);

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
              adjustment_points: adjustments[key] || 0,
              updated_at: new Date().toISOString(),
            });
          } else if (dbValues[key]) {
            deletes.push({ studentId: s.student_id, momento: m });
          }
        }
      }
      if (upserts.length > 0) {
        await supabase
          .from("final_grades" as any)
          .upsert(upserts as any, { onConflict: "student_id,assignment_id,momento" });
      }
      for (const d of deletes) {
        await supabase
          .from("final_grades" as any)
          .delete()
          .eq("student_id", d.studentId)
          .eq("assignment_id", assignmentId)
          .eq("momento", d.momento);
      }
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
      setDbAdjustments(prev => {
        const next = { ...prev };
        for (const u of upserts) {
          next[`${u.student_id}-${u.momento}`] = u.adjustment_points;
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
  }, [assignmentIds, students, editedGrades, dbValues, adjustments, schoolId, isDirty, totalDirty]);

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
    <TooltipProvider>
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
            {isNumeric && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p>Después de guardar una nota, puede ajustar +1 o -1 punto usando los botones al lado del campo. El ajuste acumulado se registra y quedará reflejado en la boleta del estudiante. La nota no puede exceder 20 ni ser menor a 0.</p>
                </TooltipContent>
              </Tooltip>
            )}
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
                  <TableHead key={momento} className="min-w-[180px] text-center">
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
                <TableHead className="min-w-[180px] text-center bg-muted/30">
                  <div className="font-semibold">Definitiva Final</div>
                  <span className="text-[10px] text-muted-foreground">Promedio 3 momentos</span>
                  {dirtyCountByMomento[0] > 0 && (
                    <div className="text-[10px] text-orange-500 font-medium">
                      ({dirtyCountByMomento[0]} sin guardar)
                    </div>
                  )}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
                      const isSavingAdj = savingAdjKeys.has(key);
                      const dirty = isDirty(key);
                      const value = editedGrades[key] || "";
                      const isSavedInDb = !!dbValues[key];
                      const adj = adjustments[key] || 0;
                      const gradeNum = Number(value);
                      const canAdd = isNumeric && isSavedInDb && !dirty && !isNaN(gradeNum) && gradeNum < 20;
                      const canSubtract = isNumeric && isSavedInDb && !dirty && !isNaN(gradeNum) && gradeNum > 0;

                      return (
                        <TableCell key={m} className="text-center p-1.5">
                          <div className="flex items-center justify-center gap-1">
                            {isNumeric && (
                              <button
                                type="button"
                                onClick={() => adjustPoint(s.student_id, m, -1)}
                                disabled={!canSubtract || isSavingAdj}
                                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                            )}
                            <div className="relative inline-block">
                              <Input
                                type="text"
                                inputMode={isNumeric ? "decimal" : "text"}
                                value={value}
                                onChange={(e) => handleGradeChange(s.student_id, m, e.target.value)}
                                onBlur={() => saveGrade(s.student_id, m)}
                                className={`h-8 w-20 mx-auto text-center text-sm ${dirty ? "border-orange-400 ring-1 ring-orange-300" : ""}`}
                                placeholder="—"
                              />
                              {dirty && !isSaving && !isSaved && (
                                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-400" />
                              )}
                              {(isSaving || isSavingAdj) && (
                                <Loader2 className="absolute top-1.5 right-1 h-3 w-3 animate-spin text-muted-foreground" />
                              )}
                              {isSaved && !isSaving && (
                                <Check className="absolute top-1.5 right-1 h-3 w-3 text-green-500" />
                              )}
                            </div>
                            {isNumeric && (
                              <button
                                type="button"
                                onClick={() => adjustPoint(s.student_id, m, 1)}
                                disabled={!canAdd || isSavingAdj}
                                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                            {adj !== 0 && (
                              <span className={`text-[10px] font-semibold min-w-[28px] ${adj > 0 ? "text-green-600" : "text-destructive"}`}>
                                {adj > 0 ? `+${adj}` : adj}
                              </span>
                            )}
                            {isNumeric && isSavedInDb && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[200px] text-xs">
                                  <p>Use +/- para ajustar la nota en 1 punto. El ajuste acumulado ({adj > 0 ? `+${adj}` : String(adj)} pts) se reflejará en la boleta.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                    {/* Definitiva Final cell */}
                    {(() => {
                      const m = 0;
                      const key = `${s.student_id}-${m}`;
                      const isSaving = savingKeys.has(key);
                      const isSaved = savedKeys.has(key);
                      const isSavingAdj = savingAdjKeys.has(key);
                      const dirty = isDirty(key);
                      const value = editedGrades[key] || "";
                      const isSavedInDb = !!dbValues[key];
                      const adj = adjustments[key] || 0;
                      const gradeNum = Number(value);
                      const canAdd = isNumeric && isSavedInDb && !dirty && !isNaN(gradeNum) && gradeNum < 20;
                      const canSubtract = isNumeric && isSavedInDb && !dirty && !isNaN(gradeNum) && gradeNum > 0;

                      return (
                        <TableCell className="text-center p-1.5 bg-muted/10">
                          <div className="flex items-center justify-center gap-1">
                            {isNumeric && (
                              <button
                                type="button"
                                onClick={() => adjustPoint(s.student_id, m, -1)}
                                disabled={!canSubtract || isSavingAdj}
                                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                            )}
                            <div className="relative inline-block">
                              <Input
                                type="text"
                                inputMode={isNumeric ? "decimal" : "text"}
                                value={value}
                                onChange={(e) => handleGradeChange(s.student_id, m, e.target.value)}
                                onBlur={() => saveGrade(s.student_id, m)}
                                className={`h-8 w-20 mx-auto text-center text-sm font-semibold ${dirty ? "border-orange-400 ring-1 ring-orange-300" : ""}`}
                                placeholder="—"
                              />
                              {dirty && !isSaving && !isSaved && (
                                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-orange-400" />
                              )}
                              {(isSaving || isSavingAdj) && (
                                <Loader2 className="absolute top-1.5 right-1 h-3 w-3 animate-spin text-muted-foreground" />
                              )}
                              {isSaved && !isSaving && (
                                <Check className="absolute top-1.5 right-1 h-3 w-3 text-green-500" />
                              )}
                            </div>
                            {isNumeric && (
                              <button
                                type="button"
                                onClick={() => adjustPoint(s.student_id, m, 1)}
                                disabled={!canAdd || isSavingAdj}
                                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            )}
                            {adj !== 0 && (
                              <span className={`text-[10px] font-semibold min-w-[28px] ${adj > 0 ? "text-green-600" : "text-destructive"}`}>
                                {adj > 0 ? `+${adj}` : adj}
                              </span>
                            )}
                            {isNumeric && isSavedInDb && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-3 w-3 text-muted-foreground cursor-help shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-[200px] text-xs">
                                  <p>Use +/- para ajustar la nota final. Ajuste acumulado: {adj > 0 ? `+${adj}` : String(adj)} pts.</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      );
                    })()}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </>
    </TooltipProvider>
  );
}
