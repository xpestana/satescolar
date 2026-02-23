import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal",
  maternal: "Maternal",
  inicial: "Inicial",
  primaria: "Primaria",
  media_general: "Media General",
  media_tecnica: "Media Técnica",
};

const ENROLLMENT_TYPES = [
  "Regular",
  "Becado",
  "Regular con materia pendiente",
  "Nuevo Ingreso",
  "Propedéutico",
  "Repitiente",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    document_id: string | null;
    photo_url: string | null;
    form_data: Record<string, string> | null;
    familyName: string;
    isEnrolled: boolean;
  };
  activeYear: { id: string; year_range: string };
  sections: { id: string; name: string; grade_level: string }[];
  schoolId: string;
  onSuccess: () => void;
}

export function EnrollStudentModal({ open, onOpenChange, student, activeYear, sections, schoolId, onSuccess }: Props) {
  const { toast } = useToast();
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [enrollmentType, setEnrollmentType] = useState("");
  const [enrollmentDate, setEnrollmentDate] = useState(new Date().toISOString().split("T")[0]);
  // Fetch display config for this school
  const { data: displayConfig = [] } = useQuery({
    queryKey: ["enrollment-display-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollment_display_config")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_visible", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch student form fields to know labels
  const { data: formFields = [] } = useQuery({
    queryKey: ["student-form-fields", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label")
        .eq("school_id", schoolId)
        .eq("form_type", "student")
        .order("field_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSectionId) throw new Error("Selecciona una sección");
      if (!enrollmentType) throw new Error("Selecciona el tipo de inscripción");

      // Upsert: if already enrolled, update; otherwise insert
      const { error } = await supabase
        .from("enrollments")
        .upsert({
          student_id: student.id,
          section_id: selectedSectionId,
          school_year_id: activeYear.id,
          school_id: schoolId,
          enrollment_type: enrollmentType,
          enrollment_date: enrollmentDate || null,
        } as any, { onConflict: "student_id,school_year_id,school_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Estudiante inscrito", description: "La inscripción se realizó correctamente." });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });

  const getStudentName = () => {
    const fd = student.form_data;
    if (!fd) return "Sin nombre";
    return [fd.primer_nombre, fd.segundo_nombre, fd.primer_apellido, fd.segundo_apellido].filter(Boolean).join(" ") || "Sin nombre";
  };

  // Determine which fields to show
  const fieldsToShow = displayConfig.length > 0
    ? displayConfig.map(dc => ({
        name: dc.field_name,
        label: dc.field_label,
      }))
    : // Default: show basic fields
      [
        { name: "primer_nombre", label: "Primer Nombre" },
        { name: "segundo_nombre", label: "Segundo Nombre" },
        { name: "primer_apellido", label: "Primer Apellido" },
        { name: "segundo_apellido", label: "Segundo Apellido" },
        { name: "fecha_nacimiento", label: "Fecha de Nacimiento" },
        { name: "genero", label: "Género" },
        { name: "grado", label: "Grado" },
      ];

  // Group sections by grade level
  const sectionsByGrade = sections.reduce((acc, s) => {
    const label = GRADE_LABELS[s.grade_level] || s.grade_level;
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {} as Record<string, typeof sections>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscribir Estudiante</DialogTitle>
        </DialogHeader>

        {/* Student info */}
        <div className="flex items-center gap-4 mb-4">
          {student.photo_url ? (
            <img src={student.photo_url} alt="" className="h-16 w-16 rounded-full object-cover border-2 border-primary" />
          ) : (
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
              {getStudentName().charAt(0)}
            </div>
          )}
          <div>
            <p className="font-semibold text-lg">{getStudentName()}</p>
            <p className="text-sm text-muted-foreground">Cédula: {student.document_id || "—"}</p>
            <p className="text-sm text-muted-foreground">Familia: {student.familyName}</p>
          </div>
        </div>

        <Separator />

        {/* Student data fields */}
        <div className="grid grid-cols-2 gap-3 my-4">
          {fieldsToShow.map(field => (
            <div key={field.name}>
              <p className="text-xs text-muted-foreground">{field.label}</p>
              <p className="text-sm font-medium">{student.form_data?.[field.name] || "—"}</p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Enrollment form */}
        <div className="space-y-4 my-4">
          <div>
            <Label className="text-sm font-medium">Año Escolar</Label>
            <div className="mt-1">
              <Badge variant="default" className="text-sm px-3 py-1">{activeYear.year_range}</Badge>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Sección *</Label>
            <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccionar sección..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sectionsByGrade).map(([grade, secs]) => (
                  <div key={grade}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{grade}</div>
                    {secs.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {grade} - Sección {s.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Tipo de Inscripción *</Label>
            <Select value={enrollmentType} onValueChange={setEnrollmentType}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleccione una opción..." />
              </SelectTrigger>
              <SelectContent>
                {ENROLLMENT_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Fecha de Inscripción</Label>
            <Input
              type="date"
              value={enrollmentDate}
              onChange={(e) => setEnrollmentDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => enrollMutation.mutate()}
            disabled={!selectedSectionId || !enrollmentType || enrollMutation.isPending}
          >
            {enrollMutation.isPending ? "Inscribiendo..." : student.isEnrolled ? "Actualizar Inscripción" : "Inscribir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
