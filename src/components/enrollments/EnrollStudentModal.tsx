import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { isEffectivelyRequired } from "@/lib/protected-fields";

import { AlertTriangle, GraduationCap, Users, UserPen } from "lucide-react";

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
  const qc = useQueryClient();
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [enrollmentType, setEnrollmentType] = useState("");
  const [enrollmentDate, setEnrollmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [observations, setObservations] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("none");

  // Fetch existing enrollment data for pre-population
  const { data: existingEnrollment } = useQuery({
    queryKey: ["existing-enrollment", student.id, activeYear.id, schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("section_id, enrollment_type, enrollment_date, observations")
        .eq("student_id", student.id)
        .eq("school_year_id", activeYear.id)
        .eq("school_id", schoolId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!student.id && !!activeYear.id && !!schoolId && student.isEnrolled,
  });

  // Planes de pago activos del colegio (asignación opcional al inscribir)
  const { data: availablePlans = [] } = useQuery({
    queryKey: ["available-plans", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_plans")
        .select("id, name, description")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!schoolId && open,
  });

  // Plan actual del estudiante (si ya tiene uno asignado este año)
  const { data: currentPlan } = useQuery({
    queryKey: ["student-current-plan", student.id, activeYear.id, schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_payment_plans")
        .select("id, plan_id")
        .eq("student_id", student.id)
        .eq("school_year_id", activeYear.id)
        .eq("school_id", schoolId)
        .order("assigned_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!student.id && !!activeYear.id && !!schoolId && open,
  });

  // Pre-populate form when existing enrollment loads
  useEffect(() => {
    if (existingEnrollment && open) {
      setSelectedSectionId(existingEnrollment.section_id || "");
      setEnrollmentType(existingEnrollment.enrollment_type || "");
      setEnrollmentDate(existingEnrollment.enrollment_date || new Date().toISOString().split("T")[0]);
      setObservations(existingEnrollment.observations || "");
    }
  }, [existingEnrollment, open]);

  // Pre-populate plan select with the student's current plan
  useEffect(() => {
    if (open) setSelectedPlanId(currentPlan?.plan_id || "none");
  }, [currentPlan, open]);

  // Reset when modal closes
  useEffect(() => {
    if (!open) {
      if (!student.isEnrolled) {
        setSelectedSectionId("");
        setEnrollmentType("");
        setEnrollmentDate(new Date().toISOString().split("T")[0]);
        setObservations("");
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

  // Fetch ALL form fields (student + representative) — used for labels and required validation
  const { data: allFormFields = [] } = useQuery({
    queryKey: ["all-form-fields-enroll", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("field_name, field_label, form_type, is_required, is_visible")
        .eq("school_id", schoolId)
        .in("form_type", ["student", "representative"])
        .order("field_order");
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  const formFields = allFormFields.filter(f => f.form_type === "student");

  // Fetch planilla sections only to detect "Observaciones" section visibility
  const { data: planillaSections = [] } = useQuery({
    queryKey: ["enrollment-planilla-sections", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollment_planilla_sections")
        .select("title")
        .eq("school_id", schoolId);
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


  // Completeness check based on required fields from saved forms
  const isEmpty = (v: any) =>
    v === null || v === undefined || (typeof v === "string" && !v.trim());

  const requiredStudent = allFormFields.filter(f => f.form_type === "student" && f.is_visible && isEffectivelyRequired("student", f.field_name, f.is_required));
  const requiredRep = allFormFields.filter(f => f.form_type === "representative" && f.is_visible && isEffectivelyRequired("representative", f.field_name, f.is_required));

  const missingStudentFields = requiredStudent
    .filter(f => isEmpty(student.form_data?.[f.field_name]))
    .map(f => `student:${f.field_name}`);

  const repFormData = (primaryRep?.form_data as Record<string, any> | null) || null;
  const missingRepresentativeFields = primaryRep
    ? requiredRep.filter(f => isEmpty(repFormData?.[f.field_name])).map(f => `representative:${f.field_name}`)
    : [];

  const completeness = {
    isComplete: missingStudentFields.length === 0 && missingRepresentativeFields.length === 0,
    missingStudentFields,
    missingRepresentativeFields,
    missingFamilyFields: [] as string[],
  };

  const hasStudentMissing = completeness.missingStudentFields.length > 0;
  const hasRepMissing = completeness.missingRepresentativeFields.length > 0;
  const hasFamilyMissing = false;
  const isDataComplete = completeness.isComplete;

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
          observations: observations.trim() || null,
        } as any, { onConflict: "student_id,school_year_id,school_id" });

      if (error) throw error;

      // Asignación opcional de plan de pago ("none" = dejar sin plan por ahora)
      if (selectedPlanId && selectedPlanId !== "none") {
        if (currentPlan) {
          if (currentPlan.plan_id !== selectedPlanId) {
            const { error: planErr } = await supabase
              .from("student_payment_plans")
              .update({ plan_id: selectedPlanId, assigned_at: new Date().toISOString() })
              .eq("id", currentPlan.id);
            if (planErr) throw planErr;
          }
        } else {
          const { error: planErr } = await supabase
            .from("student_payment_plans")
            .insert({
              student_id: student.id,
              plan_id: selectedPlanId,
              school_id: schoolId,
              school_year_id: activeYear.id,
            });
          if (planErr) throw planErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-student-plans"] });
      qc.invalidateQueries({ queryKey: ["all-student-balances"] });
      qc.invalidateQueries({ queryKey: ["student-current-plan"] });
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

  // Reverse map: label -> enum key
  const GRADE_LABEL_TO_KEY = Object.fromEntries(
    Object.entries(GRADE_LABELS).map(([k, v]) => [v, k])
  );

  // Filter sections by student's grade level
  const studentGradeLabel = student.form_data?.nivel_grado as string | undefined;
  const studentGradeKey = studentGradeLabel ? (GRADE_LABEL_TO_KEY[studentGradeLabel] || studentGradeLabel) : undefined;
  const filteredSections = studentGradeKey
    ? sections.filter(s => s.grade_level === studentGradeKey)
    : sections;

  const hasNoSections = filteredSections.length === 0;

  // Check if planilla has an "Observaciones" section
  const hasObservationsSection = planillaSections.some(s =>
    s.title?.toLowerCase().includes("observacion") || s.title?.toLowerCase().includes("observación")
  );

  // Resolve field label for missing fields display
  const resolveLabel = (prefixed: string) => {
    const [type, ...rest] = prefixed.split(":");
    const name = rest.join(":");
    const match = allFormFields.find(f => f.form_type === type && f.field_name === name);
    if (match?.field_label) return match.field_label;
    return name.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
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
            {hasNoSections ? (
              <div className="mt-1 text-sm text-muted-foreground border rounded-md p-2 bg-muted/50">
                No hay secciones creadas.{" "}
                <Link
                  to="/school/configuraciones/anos-secciones"
                  className="text-primary underline hover:no-underline"
                  onClick={() => onOpenChange(false)}
                >
                  Agregar secciones
                </Link>
              </div>
            ) : (
              <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar sección..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredSections.map(s => {
                    const gradeLabel = GRADE_LABELS[s.grade_level] || s.grade_level;
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {gradeLabel} - Sección {s.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
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
            <Label className="text-sm font-medium">Plan de Pago</Label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sin plan por ahora..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin plan por ahora</SelectItem>
                {availablePlans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hasObservationsSection && (
          <div className="my-2">
            <Label className="text-sm font-medium">Observaciones</Label>
            <Textarea
              placeholder="Observaciones particulares del estudiante para este año escolar (opcional)"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1 resize-none"
              rows={3}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => { onOpenChange(false); window.location.href = `/registros/familias/${student.family_id}/estudiante/${student.id}/editar`; }}>
              <GraduationCap className="h-4 w-4" />
              Modificar Estudiante
            </Button>
            {primaryRep && (
              <Button variant="secondary" size="sm" className="gap-1" onClick={() => { onOpenChange(false); window.location.href = `/registros/familias/${student.family_id}/representante/${primaryRep.id}/editar`; }}>
                <UserPen className="h-4 w-4" />
                Modificar Representante
              </Button>
            )}
            <Button variant="secondary" size="sm" className="gap-1" onClick={() => { onOpenChange(false); window.location.href = `/registros/familias/${student.family_id}/editar`; }}>
              <Users className="h-4 w-4" />
              Modificar Familia
            </Button>
            {isDataComplete && (
              <Button
                onClick={() => enrollMutation.mutate()}
                disabled={!selectedSectionId || !enrollmentType || enrollMutation.isPending}
              >
                {enrollMutation.isPending ? "Inscribiendo..." : student.isEnrolled ? "Actualizar Inscripción" : "Inscribir"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
