import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal", maternal: "Maternal", inicial: "Inicial",
  i_nivel: "I Nivel", ii_nivel: "II Nivel", iii_nivel: "III Nivel",
  primaria: "Primaria",
  "1_grado": "1er Grado", "2_grado": "2do Grado", "3_grado": "3er Grado",
  "4_grado": "4to Grado", "5_grado": "5to Grado", "6_grado": "6to Grado",
  media_general: "Media General",
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año",
  media_tecnica: "Media Técnica", "6_ano": "6to Año",
};

const NUMERIC_GRADES = new Set([
  "media_general", "1_ano", "2_ano", "3_ano", "4_ano", "5_ano",
  "media_tecnica", "6_ano",
]);

export default function GradesConsultation() {
  const { schoolId } = useSchoolId();
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedMomento, setSelectedMomento] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState("");

  // School years
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["school-years", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years")
        .select("id, year_range, is_active")
        .eq("school_id", schoolId!)
        .order("year_range", { ascending: false });
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Auto-select active year
  const activeYear = schoolYears.find((y) => y.is_active);
  const effectiveYear = selectedYear || activeYear?.id || "";

  // Subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ["school-subjects-list", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_subjects")
        .select("id, name")
        .eq("school_id", schoolId!)
        .eq("is_suspended", false)
        .order("name");
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Sections
  const { data: sections = [] } = useQuery({
    queryKey: ["school-sections-list", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sections")
        .select("id, name, grade_level")
        .eq("school_id", schoolId!)
        .order("grade_level")
        .order("name");
      return data || [];
    },
    enabled: !!schoolId,
  });

  // Find the assignment for the selected filters
  const { data: assignment, isLoading: assignmentLoading } = useQuery({
    queryKey: ["assignment-lookup", effectiveYear, selectedSubject, selectedSection],
    queryFn: async () => {
      const { data } = await supabase
        .from("subject_teacher_assignments")
        .select("id, section:section_id(id, grade_level)")
        .eq("school_year_id", effectiveYear)
        .eq("subject_id", selectedSubject)
        .eq("section_id", selectedSection)
        .eq("school_id", schoolId!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!effectiveYear && !!selectedSubject && !!selectedSection && !!schoolId,
  });

  const gradeLevel = assignment?.section?.grade_level as string | undefined;
  const isNumeric = gradeLevel ? NUMERIC_GRADES.has(gradeLevel) : false;

  // Plan items for the momento
  const { data: planItems = [], isLoading: planLoading } = useQuery({
    queryKey: ["consult-plan-items", assignment?.id, selectedMomento],
    queryFn: async () => {
      const { data } = await supabase
        .from("evaluation_plan_items")
        .select("*")
        .eq("assignment_id", assignment!.id)
        .eq("momento", selectedMomento)
        .order("display_order", { ascending: true });
      return data || [];
    },
    enabled: !!assignment?.id,
  });

  // Enrolled students
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["consult-students", selectedSection, effectiveYear, schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("student_id, student:student_id(id, document_id, form_data)")
        .eq("section_id", selectedSection)
        .eq("school_year_id", effectiveYear)
        .eq("school_id", schoolId!);
      return (data || []).map((e: any) => {
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
    enabled: !!selectedSection && !!effectiveYear && !!schoolId,
  });

  // Grades
  const { data: grades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ["consult-grades", assignment?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_grades")
        .select("student_id, evaluation_plan_item_id, grade_value")
        .eq("assignment_id", assignment!.id);
      return data || [];
    },
    enabled: !!assignment?.id,
  });

  const gradesMap = useMemo(() => {
    const map: Record<string, string> = {};
    grades.forEach((g: any) => {
      map[`${g.student_id}-${g.evaluation_plan_item_id}`] = g.grade_value || "";
    });
    return map;
  }, [grades]);

  const filteredStudents = useMemo(() => {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter((s: any) =>
      s.student_name.toLowerCase().includes(term) ||
      (s.document_id && s.document_id.toLowerCase().includes(term))
    );
  }, [students, searchTerm]);

  const filtersComplete = !!effectiveYear && !!selectedSubject && !!selectedSection;
  const loading = assignmentLoading || planLoading || studentsLoading || gradesLoading;

  const selectedSectionData = sections.find((s) => s.id === selectedSection);
  const sectionLabel = selectedSectionData
    ? `${GRADE_LABELS[selectedSectionData.grade_level] || selectedSectionData.grade_level} - Sección ${selectedSectionData.name}`
    : "";

  return (
    <DashboardLayout>
      <PageHeader
        title="Consulta de Notas"
        breadcrumbs={[
          { label: "Inicio", href: "/school/dashboard" },
          { label: "Consulta de Notas" },
        ]}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Año Escolar</label>
          <Select value={effectiveYear} onValueChange={setSelectedYear}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione año" />
            </SelectTrigger>
            <SelectContent>
              {schoolYears.map((y) => (
                <SelectItem key={y.id} value={y.id}>
                  {y.year_range} {y.is_active ? "(Activo)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Área / Materia</label>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione área" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Sección</label>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione sección" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {GRADE_LABELS[s.grade_level] || s.grade_level} - {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Momento</label>
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            {[1, 2, 3].map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMomento(m)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                  selectedMomento === m
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Momento {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!filtersComplete ? (
        <div className="text-center py-12 border rounded-md bg-muted/20">
          <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Seleccione año escolar, área y sección para consultar las notas.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !assignment ? (
        <div className="text-center py-12 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">No se encontró asignación para los filtros seleccionados.</p>
        </div>
      ) : planItems.length === 0 ? (
        <div className="text-center py-12 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">No hay plan de evaluación definido para el Momento {selectedMomento}.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{sectionLabel}</span>
              <Badge variant={isNumeric ? "default" : "secondary"}>
                {isNumeric ? "Numérica (1-20)" : "Cualitativa"}
              </Badge>
              <Badge variant="outline">{filteredStudents.length} estudiantes</Badge>
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
                  {planItems.map((pi: any) => (
                    <TableHead key={pi.id} className="min-w-[150px] text-center">
                      <div>{pi.description}</div>
                      {pi.percentage != null && (
                        <span className="text-xs text-muted-foreground">{pi.percentage}%</span>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2 + planItems.length} className="text-center text-muted-foreground py-8">
                      No se encontraron estudiantes.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((s: any) => (
                    <TableRow key={s.student_id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{s.student_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.document_id || "—"}</TableCell>
                      {planItems.map((pi: any) => {
                        const val = gradesMap[`${s.student_id}-${pi.id}`];
                        return (
                          <TableCell key={pi.id} className="text-center">
                            {val ? (
                              isNumeric ? (
                                <span className={`font-semibold ${Number(val) >= 10 ? "text-green-600" : "text-destructive"}`}>
                                  {val}
                                </span>
                              ) : (
                                <span className="text-sm text-foreground">{val}</span>
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
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
      )}
    </DashboardLayout>
  );
}
