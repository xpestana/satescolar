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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Loader2, LinkIcon } from "lucide-react";

interface SchoolYear {
  id: string;
  year_range: string;
  is_active: boolean;
}

interface Subject {
  id: string;
  name: string;
  subject_type: string;
  is_suspended: boolean;
}

interface Teacher {
  id: string;
  form_data: any;
  is_suspended: boolean;
  document_id: string | null;
}

interface Section {
  id: string;
  name: string;
  grade_level: string;
}

interface Assignment {
  id: string;
  subject_id: string;
  teacher_id: string;
  school_year_id: string;
  school_id: string;
  section_id: string;
}

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal",
  maternal: "Maternal",
  inicial: "Inicial",
  i_nivel: "I Nivel",
  ii_nivel: "II Nivel",
  iii_nivel: "III Nivel",
  primaria: "Primaria",
  "1_grado": "1er Grado",
  "2_grado": "2do Grado",
  "3_grado": "3er Grado",
  "4_grado": "4to Grado",
  "5_grado": "5to Grado",
  "6_grado": "6to Grado",
  media_general: "Media General",
  "1_ano": "1er Año",
  "2_ano": "2do Año",
  "3_ano": "3er Año",
  "4_ano": "4to Año",
  "5_ano": "5to Año",
  media_tecnica: "Media Técnica",
  "6_ano": "6to Año",
};

function getTeacherName(t: Teacher): string {
  const fd = t.form_data || {};
  const parts = [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : t.document_id || "Sin nombre";
}

function getSectionLabel(s: Section): string {
  return `${GRADE_LABELS[s.grade_level] || s.grade_level} - ${s.name}`;
}

export default function SubjectAssignments() {
  const { schoolId, isLoading: schoolLoading } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedYearId, setSelectedYearId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formSubjectId, setFormSubjectId] = useState("");
  const [formTeacherId, setFormTeacherId] = useState("");
  const [formSectionId, setFormSectionId] = useState("");

  // Fetch school years
  const { data: schoolYears = [] } = useQuery({
    queryKey: ["school-years", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_years")
        .select("*")
        .eq("school_id", schoolId!)
        .order("year_range", { ascending: false });
      if (error) throw error;
      return data as SchoolYear[];
    },
    enabled: !!schoolId,
  });

  // Auto-select active year
  useMemo(() => {
    if (!selectedYearId && schoolYears.length > 0) {
      const active = schoolYears.find((y) => y.is_active);
      setSelectedYearId(active?.id || schoolYears[0].id);
    }
  }, [schoolYears, selectedYearId]);

  // Fetch subjects (non-suspended)
  const { data: subjects = [] } = useQuery({
    queryKey: ["school-subjects-active", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_subjects" as any)
        .select("*")
        .eq("school_id", schoolId!)
        .eq("is_suspended", false)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Subject[];
    },
    enabled: !!schoolId,
  });

  // Fetch teachers (non-suspended)
  const { data: teachers = [] } = useQuery({
    queryKey: ["school-teachers-active", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, form_data, is_suspended, document_id")
        .eq("school_id", schoolId!)
        .eq("is_suspended", false)
        .order("created_at");
      if (error) throw error;
      return data as Teacher[];
    },
    enabled: !!schoolId,
  });

  // Fetch sections
  const { data: sections = [] } = useQuery({
    queryKey: ["school-sections", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, name, grade_level")
        .eq("school_id", schoolId!)
        .order("grade_level")
        .order("name");
      if (error) throw error;
      return data as Section[];
    },
    enabled: !!schoolId,
  });

  // Fetch assignments for selected year
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ["subject-teacher-assignments", schoolId, selectedYearId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subject_teacher_assignments" as any)
        .select("*")
        .eq("school_id", schoolId!)
        .eq("school_year_id", selectedYearId);
      if (error) throw error;
      return (data || []) as unknown as Assignment[];
    },
    enabled: !!schoolId && !!selectedYearId,
  });

  // Create assignment
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!formSubjectId || !formTeacherId || !formSectionId) throw new Error("Selecciona área, docente y sección");
      const { error } = await supabase
        .from("subject_teacher_assignments" as any)
        .insert({
          school_id: schoolId,
          subject_id: formSubjectId,
          teacher_id: formTeacherId,
          school_year_id: selectedYearId,
          section_id: formSectionId,
        } as any);
      if (error) {
        if (error.code === "23505") throw new Error("Esta asignación ya existe para esa sección");
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-teacher-assignments", schoolId, selectedYearId] });
      toast({ title: "Asignación creada", description: "Área asignada al docente exitosamente" });
      setDialogOpen(false);
      setFormSubjectId("");
      setFormTeacherId("");
      setFormSectionId("");
    },
    onError: (err: any) => {
      toast({ variant: "destructive", title: "Error", description: err.message });
    },
  });

  // Delete assignment
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("subject_teacher_assignments" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subject-teacher-assignments", schoolId, selectedYearId] });
      toast({ title: "Eliminada", description: "Asignación eliminada exitosamente" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la asignación" });
    },
  });

  // Build enriched list
  const enrichedAssignments = useMemo(() => {
    return assignments.map((a) => {
      const subject = subjects.find((s) => s.id === a.subject_id);
      const teacher = teachers.find((t) => t.id === a.teacher_id);
      const section = sections.find((s) => s.id === a.section_id);
      return {
        ...a,
        subjectName: subject?.name || "—",
        subjectType: subject?.subject_type || "regular",
        teacherName: teacher ? getTeacherName(teacher) : "—",
        sectionLabel: section ? getSectionLabel(section) : "—",
      };
    });
  }, [assignments, subjects, teachers, sections]);

  // Group by subject
  const groupedBySubject = useMemo(() => {
    const map = new Map<string, typeof enrichedAssignments>();
    for (const a of enrichedAssignments) {
      const key = a.subject_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries()).sort((a, b) => a[1][0].subjectName.localeCompare(b[1][0].subjectName));
  }, [enrichedAssignments]);

  const selectedYear = schoolYears.find((y) => y.id === selectedYearId);

  if (schoolLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Asignación de Áreas"
        breadcrumbs={[{ label: "Registros" }, { label: "Asignación de Áreas" }]}
      />

      <div className="space-y-4">
        {/* Year selector + Add button */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div className="space-y-1.5 min-w-[220px]">
            <Label>Año Escolar</Label>
            <Select value={selectedYearId} onValueChange={setSelectedYearId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar año escolar" />
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

          <Button onClick={() => setDialogOpen(true)} disabled={!selectedYearId || subjects.length === 0 || teachers.length === 0 || sections.length === 0}>
            <Plus className="h-4 w-4 mr-2" /> Nueva Asignación
          </Button>
        </div>

        {!selectedYearId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Selecciona un año escolar para ver las asignaciones</p>
            </CardContent>
          </Card>
        ) : assignmentsLoading ? (
          <Card>
            <CardContent className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : enrichedAssignments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <LinkIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay asignaciones para {selectedYear?.year_range}</p>
              {subjects.length === 0 && <p className="text-sm text-muted-foreground mt-2">Primero debes crear áreas en la sección de Áreas</p>}
              {teachers.length === 0 && <p className="text-sm text-muted-foreground mt-2">Primero debes registrar docentes</p>}
              {sections.length === 0 && <p className="text-sm text-muted-foreground mt-2">Primero debes crear secciones en Años / Secciones</p>}
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
                      <TableHead>Sección / Grado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedBySubject.map(([subjectId, items]) =>
                      items.map((a, idx) => (
                        <TableRow key={a.id}>
                          {idx === 0 ? (
                            <>
                              <TableCell rowSpan={items.length} className="font-medium align-top border-r">
                                {a.subjectName}
                              </TableCell>
                              <TableCell rowSpan={items.length} className="align-top border-r">
                                <Badge variant={a.subjectType === "gcrp" ? "default" : "secondary"}>
                                  {a.subjectType === "gcrp" ? "GCRP" : "Regular"}
                                </Badge>
                              </TableCell>
                            </>
                          ) : null}
                          <TableCell>{a.teacherName}</TableCell>
                          <TableCell>{a.sectionLabel}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteMutation.mutate(a.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Eliminar
                            </Button>
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Asignación — {selectedYear?.year_range}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Área / Materia *</Label>
              <Select value={formSubjectId} onValueChange={setFormSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar área" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.subject_type === "gcrp" ? "(GCRP)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Docente *</Label>
              <Select value={formTeacherId} onValueChange={setFormTeacherId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar docente" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {getTeacherName(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sección *</Label>
              <Select value={formSectionId} onValueChange={setFormSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar sección" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {getSectionLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !formSubjectId || !formTeacherId || !formSectionId}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Asignar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
