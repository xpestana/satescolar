import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search, Loader2, Eye, Check, ChevronsUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import FinalGradesTab from "@/components/grades/FinalGradesTab";

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
  const [activeTab, setActiveTab] = useState("consulta");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedGcrpAssignment, setSelectedGcrpAssignment] = useState<string>("");
  const [selectedMomento, setSelectedMomento] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [gradeModal, setGradeModal] = useState<{ studentName: string; itemName: string; value: string } | null>(null);
  const [openYear, setOpenYear] = useState(false);
  const [openSubject, setOpenSubject] = useState(false);
  const [openSection, setOpenSection] = useState(false);
  const [openGcrpTeacher, setOpenGcrpTeacher] = useState(false);
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
        .select("id, name, subject_type")
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

  const selectedSubjectIsGcrp = subjects.find(s => s.id === selectedSubject)?.subject_type === "gcrp";

  // For GCRP: fetch all assignments with teacher info so user can pick one
  const { data: gcrpAssignments = [] } = useQuery({
    queryKey: ["gcrp-assignments-lookup", effectiveYear, selectedSubject, schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("subject_teacher_assignments")
        .select("id, teacher:teacher_id(id, form_data, document_id)")
        .eq("school_year_id", effectiveYear)
        .eq("subject_id", selectedSubject)
        .eq("school_id", schoolId!)
        .eq("is_suspended", false)
        .is("section_id", null);
      return (data || []).map((a: any) => {
        const fd = a.teacher?.form_data as Record<string, any> | null;
        const name = `${fd?.nombre || fd?.primer_nombre || ""} ${fd?.apellido || fd?.primer_apellido || ""}`.trim() || "Sin nombre";
        return { id: a.id, teacherName: name, teacherDoc: a.teacher?.document_id };
      });
    },
    enabled: !!effectiveYear && !!selectedSubject && !!schoolId && selectedSubjectIsGcrp,
  });

  // Find the assignment(s) for the selected filters
  const { data: assignments = [], isLoading: assignmentLoading } = useQuery({
    queryKey: ["assignment-lookup", effectiveYear, selectedSubject, selectedSection, selectedGcrpAssignment],
    queryFn: async () => {
      if (selectedSubjectIsGcrp) {
        // For GCRP, use the selected assignment only
        if (!selectedGcrpAssignment) return [];
        const { data, error } = await supabase
          .from("subject_teacher_assignments")
          .select("id, section_id, section:section_id(id, grade_level), subject:subject_id(subject_type)")
          .eq("id", selectedGcrpAssignment);
        if (error) throw error;
        return data || [];
      } else {
        const { data, error } = await supabase
          .from("subject_teacher_assignments")
          .select("id, section_id, section:section_id(id, grade_level), subject:subject_id(subject_type)")
          .eq("school_year_id", effectiveYear)
          .eq("subject_id", selectedSubject)
          .eq("school_id", schoolId!)
          .eq("section_id", selectedSection);
        if (error) throw error;
        return data || [];
      }
    },
    enabled: !!effectiveYear && !!selectedSubject && !!schoolId && (selectedSubjectIsGcrp ? !!selectedGcrpAssignment : !!selectedSection),
  });

  const assignment = assignments.length > 0 ? assignments[0] : null;
  const assignmentIds = assignments.map((a: any) => a.id);
  const isGcrpQuery = assignment?.subject?.subject_type === "gcrp";

  const gradeLevel = assignment?.section?.grade_level as string | undefined;
  const isNumeric = isGcrpQuery || (gradeLevel ? NUMERIC_GRADES.has(gradeLevel) : false);

  // Plan items for the momento (across all assignments for this subject+section)
  const { data: planItems = [], isLoading: planLoading } = useQuery({
    queryKey: ["consult-plan-items", assignmentIds, selectedMomento],
    queryFn: async () => {
      const { data } = await supabase
        .from("evaluation_plan_items")
        .select("*")
        .in("assignment_id", assignmentIds)
        .eq("momento", selectedMomento)
        .order("display_order", { ascending: true });
      return data || [];
    },
    enabled: assignmentIds.length > 0,
  });

  // Students: regular from enrollments, GCRP from gcrp_assignment_students
  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["consult-students", selectedSection, effectiveYear, schoolId, isGcrpQuery, assignmentIds],
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
          .eq("school_id", schoolId!);
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

  // Grades
  const { data: grades = [], isLoading: gradesLoading } = useQuery({
    queryKey: ["consult-grades", assignmentIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_grades")
        .select("student_id, evaluation_plan_item_id, grade_value")
        .in("assignment_id", assignmentIds);
      return data || [];
    },
    enabled: assignmentIds.length > 0,
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

  const filtersComplete = !!effectiveYear && !!selectedSubject && (selectedSubjectIsGcrp ? !!selectedGcrpAssignment : !!selectedSection);
  const loading = assignmentLoading || planLoading || studentsLoading || gradesLoading;

  const selectedSectionData = sections.find((s) => s.id === selectedSection);
  const sectionLabel = selectedSubjectIsGcrp
    ? `GCRP — ${gcrpAssignments.find(a => a.id === selectedGcrpAssignment)?.teacherName || "Docente"}`
    : selectedSectionData
      ? `${GRADE_LABELS[selectedSectionData.grade_level] || selectedSectionData.grade_level} - Sección ${selectedSectionData.name}`
      : "";

  return (
    <DashboardLayout>
      <PageHeader
        title="Consulta de Notas y Boletas"
        breadcrumbs={[
          { label: "Inicio", href: "/school/dashboard" },
          { label: "Consulta de Notas y Boletas" },
        ]}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Año Escolar</label>
          <Popover open={openYear} onOpenChange={setOpenYear}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={openYear} className="w-full justify-between font-normal">
                {effectiveYear ? (schoolYears.find(y => y.id === effectiveYear)?.year_range + (schoolYears.find(y => y.id === effectiveYear)?.is_active ? " (Activo)" : "")) : "Seleccione año"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Buscar año..." />
                <CommandList>
                  <CommandEmpty>No se encontró.</CommandEmpty>
                  <CommandGroup>
                    {schoolYears.map((y) => (
                      <CommandItem key={y.id} value={y.year_range} onSelect={() => { setSelectedYear(y.id); setOpenYear(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", effectiveYear === y.id ? "opacity-100" : "opacity-0")} />
                        {y.year_range} {y.is_active ? "(Activo)" : ""}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Área / Materia</label>
          <Popover open={openSubject} onOpenChange={setOpenSubject}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={openSubject} className="w-full justify-between font-normal">
                {selectedSubject ? subjects.find(s => s.id === selectedSubject)?.name || "Seleccione área" : "Seleccione área"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
              <Command>
                <CommandInput placeholder="Buscar área..." />
                <CommandList>
                  <CommandEmpty>No se encontró.</CommandEmpty>
                  <CommandGroup>
                    {subjects.map((s) => (
                      <CommandItem key={s.id} value={s.name} onSelect={() => { setSelectedSubject(s.id); if (s.subject_type === "gcrp") { setSelectedSection(""); setSelectedGcrpAssignment(""); } else { setSelectedGcrpAssignment(""); } setOpenSubject(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", selectedSubject === s.id ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">{s.name}</span>
                        {s.subject_type === "gcrp" && (
                          <Badge variant="default" className="ml-2 text-[10px] px-1.5 py-0">GCRP</Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">
            {selectedSubjectIsGcrp ? "Docente" : "Sección"}
          </label>
          {selectedSubjectIsGcrp ? (
            <Popover open={openGcrpTeacher} onOpenChange={setOpenGcrpTeacher}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={openGcrpTeacher} className="w-full justify-between font-normal">
                  {selectedGcrpAssignment
                    ? gcrpAssignments.find(a => a.id === selectedGcrpAssignment)?.teacherName || "Seleccione docente"
                    : "Seleccione docente"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Buscar docente..." />
                  <CommandList>
                    <CommandEmpty>No se encontró.</CommandEmpty>
                    <CommandGroup>
                      {gcrpAssignments.map((a) => (
                        <CommandItem key={a.id} value={a.teacherName} onSelect={() => { setSelectedGcrpAssignment(a.id); setOpenGcrpTeacher(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedGcrpAssignment === a.id ? "opacity-100" : "opacity-0")} />
                          {a.teacherName}
                          {a.teacherDoc && <span className="ml-1 text-muted-foreground text-xs">({a.teacherDoc})</span>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <Popover open={openSection} onOpenChange={setOpenSection}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={openSection} className="w-full justify-between font-normal">
                  {selectedSection ? `${GRADE_LABELS[sections.find(s => s.id === selectedSection)?.grade_level || ""] || ""} - ${sections.find(s => s.id === selectedSection)?.name || ""}` : "Seleccione sección"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Buscar sección..." />
                  <CommandList>
                    <CommandEmpty>No se encontró.</CommandEmpty>
                    <CommandGroup>
                      {sections.map((s) => (
                        <CommandItem key={s.id} value={`${GRADE_LABELS[s.grade_level] || s.grade_level} ${s.name}`} onSelect={() => { setSelectedSection(s.id); setOpenSection(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedSection === s.id ? "opacity-100" : "opacity-0")} />
                          {GRADE_LABELS[s.grade_level] || s.grade_level} - {s.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="consulta">Consulta de Notas del Docente</TabsTrigger>
          <TabsTrigger value="finales">Notas Finales y Construcción de Boletas</TabsTrigger>
          <TabsTrigger value="descarga">Descarga de Boletas</TabsTrigger>
        </TabsList>

        <TabsContent value="consulta">
      {!filtersComplete ? (
        <div className="text-center py-12 border rounded-md bg-muted/20">
          <Search className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {selectedSubjectIsGcrp
              ? "Seleccione año escolar, área y docente para consultar las notas."
              : "Seleccione año escolar, área y sección para consultar las notas."}
          </p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !assignment ? (
        <div className="text-center py-12 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">No se encontró asignación para los filtros seleccionados.</p>
        </div>
      ) : (
        <>
          {planItems.length === 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 mb-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">El docente no ha definido un plan de evaluación para el Momento {selectedMomento}.</p>
            </div>
          )}
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
                  {planItems.length > 0 ? planItems.map((pi: any) => (
                    <TableHead key={pi.id} className="min-w-[150px] text-center">
                      <div>{pi.description}</div>
                      {pi.percentage != null && (
                        <span className="text-xs text-muted-foreground">{pi.percentage}%</span>
                      )}
                    </TableHead>
                  )) : (
                    <TableHead className="text-center">Estado</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2 + Math.max(planItems.length, 1)} className="text-center text-muted-foreground py-8">
                      No se encontraron estudiantes.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((s: any) => (
                    <TableRow key={s.student_id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">{s.student_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{s.document_id || "—"}</TableCell>
                      {planItems.length > 0 ? planItems.map((pi: any) => {
                        const val = gradesMap[`${s.student_id}-${pi.id}`];
                        return (
                          <TableCell key={pi.id} className="text-center">
                            {!val ? (
                              <span className="text-muted-foreground">—</span>
                            ) : isNumeric ? (
                              <span className={`font-semibold ${Number(val) >= 10 ? "text-green-600" : "text-destructive"}`}>
                                {val}
                              </span>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1 text-xs"
                                onClick={() => setGradeModal({ studentName: s.student_name, itemName: pi.description, value: val })}
                              >
                                <Eye className="h-3 w-3" />
                                Ver
                              </Button>
                            )}
                          </TableCell>
                        );
                      }) : (
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground italic">El docente no ha registrado notas</span>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
        </TabsContent>

        <TabsContent value="finales">
          <FinalGradesTab
            schoolId={schoolId!}
            effectiveYear={effectiveYear}
            selectedSubject={selectedSubject}
            selectedSection={selectedSection}
            selectedGcrpAssignment={selectedGcrpAssignment}
            selectedSubjectIsGcrp={selectedSubjectIsGcrp}
            sections={sections}
            gcrpAssignments={gcrpAssignments}
          />
        </TabsContent>

        <TabsContent value="descarga">
          <div className="text-center py-12 border rounded-md bg-muted/20">
            <p className="text-muted-foreground">Próximamente: descarga de boletas en PDF.</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal for qualitative grade detail */}
      <Dialog open={!!gradeModal} onOpenChange={() => setGradeModal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Evaluación Cualitativa</DialogTitle>
          </DialogHeader>
          {gradeModal && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Estudiante</span>
                <span className="font-medium">{gradeModal.studentName}</span>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Evaluación</span>
                <span className="font-medium">{gradeModal.itemName}</span>
              </div>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Descripción</span>
                <div className="rounded-md border bg-muted/30 p-3 whitespace-pre-wrap text-sm">
                  {gradeModal.value}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
