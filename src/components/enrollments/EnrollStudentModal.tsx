import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { checkStudentCompleteness, ENROLLMENT_CUSTOM_FIELDS } from "@/lib/enrollment-completeness";
import { AlertTriangle, GraduationCap, Users, UserPen } from "lucide-react";

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
    family_id: string;
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
  const navigate = useNavigate();
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [enrollmentType, setEnrollmentType] = useState("");
  const [enrollmentDate, setEnrollmentDate] = useState(new Date().toISOString().split("T")[0]);

  // Fetch existing enrollment data for pre-population
  const { data: existingEnrollment } = useQuery({
    queryKey: ["existing-enrollment", student.id, activeYear.id, schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("section_id, enrollment_type, enrollment_date")
        .eq("student_id", student.id)
        .eq("school_year_id", activeYear.id)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!student.id && !!activeYear.id && !!schoolId && student.isEnrolled,
  });

  // Pre-populate form when existing enrollment loads
  useEffect(() => {
    if (existingEnrollment && open) {
      setSelectedSectionId(existingEnrollment.section_id || "");
      setEnrollmentType(existingEnrollment.enrollment_type || "");
      setEnrollmentDate(existingEnrollment.enrollment_date || new Date().toISOString().split("T")[0]);
    }
  }, [existingEnrollment, open]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      if (!student.isEnrolled) {
        setSelectedSectionId("");
        setEnrollmentType("");
        setEnrollmentDate(new Date().toISOString().split("T")[0]);
      }
    }
  }, [open, student.isEnrolled]);

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

  // Fetch planilla sections for completeness validation
  const { data: planillaSections = [] } = useQuery({
    queryKey: ["enrollment-planilla-sections", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollment_planilla_sections")
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch primary representative data
  const { data: primaryRep } = useQuery({
    queryKey: ["primary-rep-modal", student.family_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("id, form_data")
        .eq("family_id", student.family_id)
        .eq("is_primary", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!student.family_id,
  });

  // Fetch family data
  const { data: familyData } = useQuery({
    queryKey: ["family-data-modal", student.family_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("id", student.family_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!student.family_id,
  });

  // Completeness check
  const completeness = planillaSections.length > 0
    ? checkStudentCompleteness(
        planillaSections.map(s => ({ field_names: Array.isArray(s.field_names) ? s.field_names as string[] : [], section_type: s.section_type })),
        student.form_data,
        primaryRep?.form_data as Record<string, string> | null,
        familyData as Record<string, any> | null,
      )
    : null;

  const hasStudentMissing = completeness ? completeness.missingStudentFields.length > 0 : false;
  const hasRepMissing = completeness ? completeness.missingRepresentativeFields.length > 0 : false;
  const hasFamilyMissing = completeness ? completeness.missingFamilyFields.length > 0 : false;
  const isDataComplete = completeness ? completeness.isComplete : true;

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSectionId) throw new Error("Selecciona una sección");
      if (!enrollmentType) throw new Error("Selecciona el tipo de inscripción");

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

  const fieldsToShow = displayConfig.length > 0
    ? displayConfig.map(dc => ({ name: dc.field_name, label: dc.field_label }))
    : [
        { name: "primer_nombre", label: "Primer Nombre" },
        { name: "segundo_nombre", label: "Segundo Nombre" },
        { name: "primer_apellido", label: "Primer Apellido" },
        { name: "segundo_apellido", label: "Segundo Apellido" },
        { name: "fecha_nacimiento", label: "Fecha de Nacimiento" },
        { name: "genero", label: "Género" },
        { name: "nivel_grado", label: "Grado" },
      ];

  const sectionsByGrade = sections.reduce((acc, s) => {
    const label = GRADE_LABELS[s.grade_level] || s.grade_level;
    if (!acc[label]) acc[label] = [];
    acc[label].push(s);
    return acc;
  }, {} as Record<string, typeof sections>);

  // Resolve field label for missing fields display
  const resolveLabel = (prefixed: string) => {
    const [type, ...rest] = prefixed.split(":");
    const name = rest.join(":");
    if (type === "student") return formFields.find(f => f.field_name === name)?.field_label || name;
    if (type === "custom") return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (type === "representative") return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    if (type === "family") return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    return name;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inscribir Estudiante</DialogTitle>
        </DialogHeader>

        {/* Student info + data fields combined */}
        <div className="flex items-start gap-4 mb-2">
          {student.photo_url ? (
            <img src={student.photo_url} alt="" className="h-14 w-14 rounded-full object-cover border-2 border-primary flex-shrink-0" />
          ) : (
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground flex-shrink-0">
              {getStudentName().charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{getStudentName()}</p>
            <p className="text-xs text-muted-foreground">Cédula: {student.document_id || "—"} · Familia: {student.familyName}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-x-4 gap-y-1 mb-2">
          {fieldsToShow.map(field => (
            <div key={field.name}>
              <p className="text-[11px] text-muted-foreground leading-tight">{field.label}</p>
              <p className="text-xs font-medium">{student.form_data?.[field.name] || "—"}</p>
            </div>
          ))}
        </div>

        <Separator />

        {/* Completeness warning */}
        {completeness && !isDataComplete && (
          <Alert className="my-4 border-orange-300 bg-orange-50 text-orange-800">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription>
              <p className="font-medium mb-2">Faltan datos por completar antes de inscribir:</p>
              {hasStudentMissing && (
                <div className="mb-1">
                  <span className="font-medium text-xs">Estudiante:</span>
                  <span className="text-xs ml-1">
                    {completeness.missingStudentFields.map(resolveLabel).join(", ")}
                  </span>
                </div>
              )}
              {hasRepMissing && (
                <div className="mb-1">
                  <span className="font-medium text-xs">Representante:</span>
                  <span className="text-xs ml-1">
                    {completeness.missingRepresentativeFields.map(resolveLabel).join(", ")}
                  </span>
                </div>
              )}
              {hasFamilyMissing && (
                <div className="mb-1">
                  <span className="font-medium text-xs">Familia:</span>
                  <span className="text-xs ml-1">
                    {completeness.missingFamilyFields.map(resolveLabel).join(", ")}
                  </span>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Enrollment form */}
        <div className="grid grid-cols-4 gap-3 my-2">
          <div>
            <Label className="text-sm font-medium">Año Escolar</Label>
            <div className="mt-1">
              <Badge variant="default" className="text-sm px-3 py-1">{activeYear.year_range}</Badge>
            </div>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {completeness && !isDataComplete ? (
            <div className="flex gap-2">
              {hasStudentMissing && (
                <Button variant="secondary" size="sm" className="gap-1" onClick={() => { onOpenChange(false); window.location.href = `/registros/familias/${student.family_id}/estudiante/${student.id}/editar`; }}>
                  <GraduationCap className="h-4 w-4" />
                  Modificar Estudiante
                </Button>
              )}
              {hasRepMissing && (
                <Button variant="secondary" size="sm" className="gap-1" onClick={() => { onOpenChange(false); window.location.href = `/registros/familias/${student.family_id}/representante/${primaryRep?.id}/editar`; }}>
                  <UserPen className="h-4 w-4" />
                  Modificar Representante
                </Button>
              )}
              {hasFamilyMissing && (
                <Button variant="secondary" size="sm" className="gap-1" onClick={() => { onOpenChange(false); window.location.href = `/registros/familias/${student.family_id}/editar`; }}>
                  <Users className="h-4 w-4" />
                  Modificar Familia
                </Button>
              )}
            </div>
          ) : (
            <Button
              onClick={() => enrollMutation.mutate()}
              disabled={!selectedSectionId || !enrollmentType || enrollMutation.isPending}
            >
              {enrollMutation.isPending ? "Inscribiendo..." : student.isEnrolled ? "Actualizar Inscripción" : "Inscribir"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
