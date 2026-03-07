import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, LinkIcon, BanIcon, PlayCircle, Users } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SchoolYear { id: string; year_range: string; is_active: boolean; }
interface Subject { id: string; name: string; subject_type: string; is_suspended: boolean; }
interface Teacher { id: string; form_data: any; is_suspended: boolean; document_id: string | null; }
interface Section { id: string; name: string; grade_level: string; }
interface Assignment { id: string; subject_id: string; teacher_id: string; school_year_id: string; school_id: string; section_id: string | null; is_suspended: boolean; }

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

function getTeacherName(t: Teacher): string {
  const fd = t.form_data || {};
  const parts = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : t.document_id || "Sin nombre";
}

function getSectionLabel(s: Section): string {
  return `${GRADE_LABELS[s.grade_level] || s.grade_level} - ${s.name}`;
}

function getStudentName(fd: any): string {
  const firstName = fd?.primer_nombre || fd?.nombre || "";
  const lastName = fd?.primer_apellido || fd?.apellido || "";
  return `${lastName} ${firstName}`.trim() || "Sin nombre";
}

export default function SubjectAssignments() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formGradeLevel, setFormGradeLevel] = useState("");
  const [formSectionId, setFormSectionId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // GCRP-specific state
  const [gcrpSelectedStudents, setGcrpSelectedStudents] = useState<Map<string, { student_id: string; student_name: string; document_id: string | null }>>(new Map());
  const [gcrpBrowseGrade, setGcrpBrowseGrade] = useState("");
  const [gcrpBrowseSection, setGcrpBrowseSection] = useState("");

  // View GCRP students modal
  const [viewGcrpAssignmentId, setViewGcrpAssignmentId] = useState<string | null>(null);

  const selectedSubject = useMemo(() => {
    return subjects_data.find((s: Subject) => s.id === formSubjectId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formSubjectId]);

  // Fetch school years
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["school-years", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_years").select("*").eq("school_id", schoolId!).order("year_range", { ascending: false });
      if (error) throw error;
      return data as SchoolYear[];
    },
    enabled: !!schoolId,
  });

  useMemo(() => {
    if (!selectedYearId && schoolYears.length > 0) {
      const active = schoolYears.find((y) => y.is_active);
      setSelectedYearId(active?.id || schoolYears[0].id);
    }
  }, [schoolYears, selectedYearId]);

  const { data: subjects_data = [] } = useQuery({
    queryKey: ["school-subjects-active", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("school_subjects" as any).select("*").eq("school_id", schoolId!).eq("is_suspended", false).order("display_order").order("name");
      if (error) throw error;
      return (data || []) as unknown as Subject[];
    },
    enabled: !!schoolId,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ["school-teachers-active", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("teachers").select("id, form_data, is_suspended, document_id").eq("school_id", schoolId!).eq("is_suspended", false).order("created_at");
      if (error) throw error;
      return data as Teacher[];
    },
    enabled: !!schoolId,
  });

  const { data: sections = [] } = useQuery({
    queryKey: ["school-sections", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("sections").select("id, name, grade_level").eq("school_id", schoolId!).order("grade_level").order("name");
      if (error) throw error;
      return data as Section[];
    },
    enabled: !!schoolId,
  });

  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["subject-teacher-assignments", schoolId, selectedYearId],
    queryFn: async () => {
      const { data, error } = await supabase.from("subject_teacher_assignments" as any).select("*").eq("school_id", schoolId!).eq("school_year_id", selectedYearId);
      if (error) throw error;
      return (data || []) as unknown as Assignment[];
    },
    enabled: !!schoolId && !!selectedYearId,
  });

  // Fetch GCRP student counts for display
  const gcrpAssignmentIds = useMemo(() => assignments.filter(a => !a.section_id).map(a => a.id), [assignments]);
  const { data: gcrpCounts = [] } = useQuery({
    queryKey: ["gcrp-counts", gcrpAssignmentIds],
    queryFn: async () => {
      if (gcrpAssignmentIds.length === 0) return [];
      const { data, error } = await supabase.from("gcrp_assignment_students" as any).select("assignment_id").in("assignment_id", gcrpAssignmentIds);
      if (error) throw error;
      return data as unknown as { assignment_id: string }[];
    },
    enabled: gcrpAssignmentIds.length > 0,
  });

  const gcrpCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    (gcrpCounts || []).forEach((c: any) => {
      map[c.assignment_id] = (map[c.assignment_id] || 0) + 1;
    });
    return map;
  }, [gcrpCounts]);

  // View GCRP students
  const { data: viewGcrpStudents = [] } = useQuery({
    queryKey: ["gcrp-students-view", viewGcrpAssignmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("gcrp_assignment_students" as any).select("student_id, student:student_id(id, document_id, form_data)").eq("assignment_id", viewGcrpAssignmentId!);
      if (error) throw error;
      return ((data || []) as any[]).map((r: any) => ({
        student_id: r.student_id,
        student_name: getStudentName(r.student?.form_data),
        document_id: r.student?.document_id,
      })).sort((a: any, b: any) => a.student_name.localeCompare(b.student_name));
    },
    enabled: !!viewGcrpAssignmentId,
  });

  // Browse students for GCRP assignment
  const { data: browseStudents = [], isLoading: browseLoading } = useQuery({
    queryKey: ["browse-students", gcrpBrowseSection, selectedYearId, schoolId],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("student_id, student:student_id(id, document_id, form_data)").eq("section_id", gcrpBrowseSection).eq("school_year_id", selectedYearId).eq("school_id", schoolId!);
      if (error) throw error;
      return ((data || []) as any[]).map((e: any) => ({
        student_id: e.student_id,
        student_name: getStudentName(e.student?.form_data),
        document_id: e.student?.document_id,
      })).sort((a: any, b: any) => a.student_name.localeCompare(b.student_name));
    },
    enabled: !!gcrpBrowseSection && !!selectedYearId && !!schoolId,
  });

  const isGcrp = useMemo(() => {
    const sub = subjects_data.find((s: Subject) => s.id === formSubjectId);
    return sub?.subject_type === "gcrp";
  }, [formSubjectId, subjects_data]);

  // Create regular assignment
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formSubjectId || !formTeacherId || !formSectionId || !formGradeLevel) throw new Error("Selecciona área, docente, nivel y sección");
      const { error } = await supabase.from("subject_teacher_assignments" as any).insert({
        school_id: schoolId, subject_id: formSubjectId, teacher_id: formTeacherId,
        school_year_id: selectedYearId, section_id: formSectionId,
      } as any);
      if (error) {
        if (error.code === "23505") throw new Error("Esta asignación ya existe para esa sección");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-teacher-assignments", schoolId, selectedYearId] });
      toast({ title: "Asignación creada", description: "Área asignada al docente exitosamente" });
      closeDialog();
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  // Create GCRP assignment
  const createGcrpMutation = useMutation({
    mutationFn: async () => {
      if (!formSubjectId || !formTeacherId) throw new Error("Selecciona área y docente");
      if (gcrpSelectedStudents.size === 0) throw new Error("Selecciona al menos un estudiante");

      // Create assignment without section_id
      const { data: newAssignment, error } = await supabase.from("subject_teacher_assignments" as any).insert({
        school_id: schoolId, subject_id: formSubjectId, teacher_id: formTeacherId,
        school_year_id: selectedYearId, section_id: null,
      } as any).select("id").single();
      if (error) throw error;

      // Insert students
      const studentRows = Array.from(gcrpSelectedStudents.values()).map(s => ({
        assignment_id: (newAssignment as any).id,
        student_id: s.student_id,
        school_id: schoolId,
      }));
      const { error: insertError } = await supabase.from("gcrp_assignment_students" as any).insert(studentRows as any);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-teacher-assignments", schoolId, selectedYearId] });
      queryClient.invalidateQueries({ queryKey: ["gcrp-counts"] });
      toast({ title: "Asignación GCRP creada", description: `Área asignada con ${gcrpSelectedStudents.size} estudiantes` });
      closeDialog();
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { count: planCount } = await supabase.from("evaluation_plan_items" as any).select("id", { count: "exact", head: true }).eq("assignment_id", id);
      const { count: gradeCount } = await supabase.from("student_grades").select("id", { count: "exact", head: true }).eq("assignment_id", id);
      if ((planCount || 0) > 0 || (gradeCount || 0) > 0) {
        throw new Error("No se puede eliminar esta asignación porque tiene planes de evaluación o notas registradas. Puedes suspenderla en su lugar.");
      }
      const { error } = await supabase.from("subject_teacher_assignments" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-teacher-assignments", schoolId, selectedYearId] });
      toast({ title: "Eliminada", description: "Asignación eliminada exitosamente" });
      setDeleteConfirm(null);
    },
    onError: (err: any) => { toast({ variant: "destructive", title: "No se puede eliminar", description: err.message }); setDeleteConfirm(null); },
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, suspend }: { id: string; suspend: boolean }) => {
      const { error } = await supabase.from("subject_teacher_assignments" as any).update({ is_suspended: suspend } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { suspend }) => {
      queryClient.invalidateQueries({ queryKey: ["subject-teacher-assignments", schoolId, selectedYearId] });
      toast({ title: suspend ? "Suspendida" : "Reactivada", description: suspend ? "La asignación ha sido suspendida" : "La asignación ha sido reactivada" });
    },
    onError: () => toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la asignación" }),
  });

  const availableGrades = useMemo(() => {
    const grades = new Set(sections.map((s) => s.grade_level));
    return Object.keys(GRADE_LABELS).filter((k) => grades.has(k));
  }, [sections]);

  const filteredSections = useMemo(() => {
    if (!formGradeLevel) return [];
    return sections.filter((s) => s.grade_level === formGradeLevel);
  }, [sections, formGradeLevel]);

  const gcrpBrowseSections = useMemo(() => {
    if (!gcrpBrowseGrade) return [];
    return sections.filter((s) => s.grade_level === gcrpBrowseGrade);
  }, [sections, gcrpBrowseGrade]);

  const enrichedAssignments = useMemo(() => {
    return assignments.map((a) => {
      const subject = subjects_data.find((s: Subject) => s.id === a.subject_id);
      const teacher = teachers.find((t) => t.id === a.teacher_id);
      const section = a.section_id ? sections.find((s) => s.id === a.section_id) : null;
      return {
        ...a,
        subjectName: subject?.name || "—",
        subjectType: subject?.subject_type || "regular",
        teacherName: teacher ? getTeacherName(teacher) : "—",
        sectionLabel: section ? getSectionLabel(section) : null,
        gcrpStudentCount: gcrpCountMap[a.id] || 0,
      };
    });
  }, [assignments, subjects_data, teachers, sections, gcrpCountMap]);

  const groupedBySubject = useMemo(() => {
    const map = new Map<string, typeof enrichedAssignments>();
    for (const a of enrichedAssignments) {
      if (!map.has(a.subject_id)) map.set(a.subject_id, []);
      map.get(a.subject_id)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => a[1][0].subjectName.localeCompare(b[1][0].subjectName));
  }, [enrichedAssignments]);

  const selectedYear = schoolYears.find((y) => y.id === selectedYearId);

  function closeDialog() {
    setDialogOpen(false);
    setFormSubjectId(""); setFormTeacherId(""); setFormGradeLevel(""); setFormSectionId("");
    setGcrpSelectedStudents(new Map()); setGcrpBrowseGrade(""); setGcrpBrowseSection("");
  }

  function toggleStudent(s: { student_id: string; student_name: string; document_id: string | null }) {
    setGcrpSelectedStudents(prev => {
      const next = new Map(prev);
      if (next.has(s.student_id)) next.delete(s.student_id);
      else next.set(s.student_id, s);
      return next;
    });
  }

  function selectAllBrowse() {
    setGcrpSelectedStudents(prev => {
      const next = new Map(prev);
      browseStudents.forEach((s: any) => next.set(s.student_id, s));
      return next;
    });
  }

  function deselectAllBrowse() {
    setGcrpSelectedStudents(prev => {
      const next = new Map(prev);
      browseStudents.forEach((s: any) => next.delete(s.student_id));
      return next;
    });
  }

  const allBrowseSelected = browseStudents.length > 0 && browseStudents.every((s: any) => gcrpSelectedStudents.has(s.student_id));

  if (schoolLoading) {
    return <DashboardLayout><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <PageHeader title="Asignación de Áreas" breadcrumbs={[{ label: "Registros" }, { label: "Asignación de Áreas" }]} />

      <div className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="space-y-1.5 min-w-[220px]">
            <Label>Año Escolar</Label>
            <Select value={selectedYearId} onValueChange={setSelectedYearId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar año escolar" /></SelectTrigger>
              <SelectContent>
                {schoolYears.map((y) => (
                  <SelectItem key={y.id} value={y.id}>{y.year_range} {y.is_active ? "(Activo)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDialogOpen(true)} disabled={!selectedYearId || subjects_data.length === 0 || teachers.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Asignación
          </Button>
        </div>

        {!selectedYearId ? (
          <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">Selecciona un año escolar para ver las asignaciones</p></CardContent></Card>
        ) : assignmentsLoading ? (
          <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>
        ) : enrichedAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay asignaciones para {selectedYear?.year_range}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Área / Materia</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Docente</TableHead>
                      <TableHead>Sección / Estudiantes</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedBySubject.map(([, items]) =>
                      items.map((a, idx) => (
                        <TableRow key={a.id}>
                          {idx === 0 && (
                            <>
                              <TableCell rowSpan={items.length} className="font-medium align-top border-r">{a.subjectName}</TableCell>
                              <TableCell rowSpan={items.length} className="align-top border-r">
                                <Badge variant={a.subjectType === "gcrp" ? "default" : "secondary"}>{a.subjectType === "gcrp" ? "GCRP" : "Regular"}</Badge>
                              </TableCell>
                            </>
                          )}
                          <TableCell>{a.teacherName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {a.subjectType === "gcrp" ? (
                                <Button variant="ghost" size="sm" className="h-auto p-0 text-sm font-normal hover:underline" onClick={() => setViewGcrpAssignmentId(a.id)}>
                                  <Users className="h-3.5 w-3.5 mr-1" />{a.gcrpStudentCount} estudiantes
                                </Button>
                              ) : (
                                a.sectionLabel || "—"
                              )}
                              {a.is_suspended && <Badge variant="outline" className="text-xs border-destructive text-destructive">Suspendida</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant={a.is_suspended ? "outline" : "secondary"} onClick={() => suspendMutation.mutate({ id: a.id, suspend: !a.is_suspended })} disabled={suspendMutation.isPending}>
                                {a.is_suspended ? <><PlayCircle className="h-3 w-3 mr-1" /> Reactivar</> : <><BanIcon className="h-3 w-3 mr-1" /> Suspender</>}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm(a.id)} disabled={deleteMutation.isPending}>
                                <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Assignment Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className={isGcrp ? "sm:max-w-2xl" : "sm:max-w-md"}>
          <DialogHeader>
            <DialogTitle>Nueva Asignación — {selectedYear?.year_range}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Área / Materia *</Label>
              <Select value={formSubjectId} onValueChange={(v) => { setFormSubjectId(v); setGcrpSelectedStudents(new Map()); setGcrpBrowseGrade(""); setGcrpBrowseSection(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar área" /></SelectTrigger>
                <SelectContent>
                  {subjects_data.map((s: Subject) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} {s.subject_type === "gcrp" ? "(GCRP)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Docente *</Label>
              <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar docente" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{getTeacherName(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Regular flow: section selection */}
            {!isGcrp && (
              <>
                <div className="space-y-2">
                  <Label>Nivel / Grado *</Label>
                  <Select value={formGradeLevel} onValueChange={(val) => { setFormGradeLevel(val); setFormSectionId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar nivel o grado" /></SelectTrigger>
                    <SelectContent>
                      {availableGrades.map((g) => (
                        <SelectItem key={g} value={g}>{GRADE_LABELS[g] || g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sección *</Label>
                  <Select value={formSectionId} onValueChange={setFormSectionId} disabled={!formGradeLevel}>
                    <SelectTrigger><SelectValue placeholder={formGradeLevel ? "Seleccionar sección" : "Primero selecciona un nivel"} /></SelectTrigger>
                    <SelectContent>
                      {filteredSections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* GCRP flow: student selection */}
            {isGcrp && (
              <div className="space-y-3 border-t pt-3">
                <Label className="text-sm font-semibold">Seleccionar Estudiantes</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nivel / Grado</Label>
                    <Select value={gcrpBrowseGrade} onValueChange={(v) => { setGcrpBrowseGrade(v); setGcrpBrowseSection(""); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {availableGrades.map((g) => (
                          <SelectItem key={g} value={g}>{GRADE_LABELS[g] || g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sección</Label>
                    <Select value={gcrpBrowseSection} onValueChange={setGcrpBrowseSection} disabled={!gcrpBrowseGrade}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        {gcrpBrowseSections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {gcrpBrowseSection && (
                  <div className="border rounded-md max-h-[200px] overflow-y-auto">
                    {browseLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : browseStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No hay estudiantes inscritos en esta sección.</p>
                    ) : (
                      <>
                        <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-3 py-1.5 border-b flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">{browseStudents.length} estudiantes</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={allBrowseSelected ? deselectAllBrowse : selectAllBrowse}>
                            {allBrowseSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                          </Button>
                        </div>
                        {browseStudents.map((s: any) => (
                          <label key={s.student_id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/40 cursor-pointer text-sm">
                            <Checkbox checked={gcrpSelectedStudents.has(s.student_id)} onCheckedChange={() => toggleStudent(s)} />
                            <span className="flex-1">{s.student_name}</span>
                            <span className="text-xs text-muted-foreground">{s.document_id || ""}</span>
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {gcrpSelectedStudents.size > 0 && (
                  <div className="bg-muted/30 rounded-md p-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">{gcrpSelectedStudents.size} estudiantes seleccionados</span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setGcrpSelectedStudents(new Map())}>Limpiar</Button>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                      {Array.from(gcrpSelectedStudents.values()).map(s => (
                        <Badge key={s.student_id} variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleStudent(s)}>
                          {s.student_name} ×
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            {isGcrp ? (
              <Button onClick={() => createGcrpMutation.mutate()} disabled={createGcrpMutation.isPending || !formSubjectId || !formTeacherId || gcrpSelectedStudents.size === 0}>
                {createGcrpMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Asignar ({gcrpSelectedStudents.size})
              </Button>
            ) : (
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !formSubjectId || !formTeacherId || !formGradeLevel || !formSectionId}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Asignar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View GCRP Students */}
      <Dialog open={!!viewGcrpAssignmentId} onOpenChange={(open) => !open && setViewGcrpAssignmentId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Estudiantes Asignados (GCRP)</DialogTitle></DialogHeader>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {viewGcrpStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin estudiantes asignados.</p>
            ) : viewGcrpStudents.map((s: any) => (
              <div key={s.student_id} className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-muted/40 text-sm">
                <span>{s.student_name}</span>
                <span className="text-xs text-muted-foreground">{s.document_id || ""}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asignación?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción eliminará la asignación permanentemente. Solo es posible si no tiene planes de evaluación ni notas registradas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
