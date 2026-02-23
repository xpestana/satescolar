import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, AlertCircle, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/families/PhotoUpload";
import { GroupedFormFields } from "@/components/forms/GroupedFormFields";
import type { Json } from "@/integrations/supabase/types";

interface FormField {
  id: string;
  field_name: string;
  field_label: string;
  field_type: string;
  is_required: boolean;
  is_visible: boolean;
  placeholder: string | null;
  options: Json | null;
  field_order: number;
  group_id: string | null;
}

interface FormFieldGroup {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
}

export default function AddStudent() {
  const { familyId, studentId } = useParams<{ familyId: string; studentId?: string }>();
  const navigate = useNavigate();
  const { schoolId } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!studentId;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formDataInitialized, setFormDataInitialized] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  // Fetch family data including geographic info
  const { data: family } = useQuery({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("father_last_name, mother_last_name, state_id, municipality_id, city_id, parish_id")
        .eq("id", familyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  // Fetch form fields for student form
  const { data: formFields = [] } = useQuery({
    queryKey: ["form-fields", schoolId, "student"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .eq("school_id", schoolId)
        .eq("form_type", "student")
        .eq("is_visible", true)
        .order("field_order");
      if (error) throw error;
      return data as FormField[];
    },
    enabled: !!schoolId,
  });

  // Fetch form field groups
  const { data: formGroups = [] } = useQuery({
    queryKey: ["form-field-groups", schoolId, "student"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_field_groups")
        .select("*")
        .eq("school_id", schoolId)
        .eq("form_type", "student")
        .order("display_order");
      if (error) throw error;
      return data as FormFieldGroup[];
    },
    enabled: !!schoolId,
  });

  // Fetch existing student data if editing
  const { data: existingStudent } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("id", studentId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!studentId,
  });

  // Reset form state when studentId changes (navigation between students)
  useEffect(() => {
    setFormData({});
    setFormDataInitialized(false);
    setPhotoBlob(null);
  }, [studentId]);

  // Load existing data when editing
  useEffect(() => {
    if (existingStudent && !formDataInitialized) {
      setFormData(existingStudent.form_data as Record<string, any> || {});
      setFormDataInitialized(true);
    }
  }, [existingStudent, formDataInitialized]);

  // Don't render form until student data is loaded AND formData is initialized
  const isStudentDataReady = !isEditing || (!!existingStudent && formDataInitialized);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = existingStudent?.photo_url || null;

      // Upload photo if provided
      if (photoBlob) {
        const fileName = `${familyId}/students/${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from("family-photos")
          .upload(fileName, photoBlob);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("family-photos")
          .getPublicUrl(fileName);

        photoUrl = urlData.publicUrl;
      }

      // Extract known fields from form_data to sync direct columns
      const documentType = formData.tipo_documento || "";
      let documentNum = formData.documento || formData.cedula || "";
      // Strip any existing type prefix (V-, E-, CE-, etc.) from the number to avoid duplication
      if (documentType && documentNum) {
        documentNum = documentNum.replace(/^(V-|E-|CE-|P-)/i, "");
      }
      const documentId = documentType && documentNum ? `${documentType}-${documentNum}` : documentNum || null;

      const studentData = {
        family_id: familyId,
        photo_url: photoUrl,
        form_data: formData,
        document_id: documentId,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("students")
          .update(studentData)
          .eq("id", studentId);
        if (error) throw error;
      } else {
        // Generate ID client-side so we can create student + association without needing SELECT back
        const newStudentId = crypto.randomUUID();
        const { error } = await supabase
          .from("students")
          .insert({ id: newStudentId, ...studentData });
        if (error) throw error;

        // Create student-school association
        const { error: assocError } = await supabase
          .from("student_schools")
          .insert({ student_id: newStudentId, school_id: schoolId });
        if (assocError) throw assocError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", familyId] });
      toast({
        title: isEditing ? "Estudiante actualizado" : "Estudiante agregado",
        description: isEditing
          ? "Los datos del estudiante se han actualizado correctamente"
          : "El estudiante ha sido agregado a la familia",
      });
      window.history.back();
    },
    onError: (error) => {
      console.error("Error saving student:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el estudiante",
      });
    },
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check required photo
    if (!photoBlob && !existingStudent?.photo_url) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La foto del estudiante es obligatoria",
      });
      return;
    }

    saveMutation.mutate();
  };

  const getFamilyName = () => {
    if (family?.father_last_name || family?.mother_last_name) {
      return `${family.father_last_name || ""} ${family.mother_last_name || ""}`.trim();
    }
    return "Por definir";
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={`${isEditing ? "Editar" : "Agregar"} Estudiante - Familia ${getFamilyName()}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/school/dashboard" },
          { label: `${isEditing ? "Editar" : "Agregar"} Estudiante - Familia ${getFamilyName()}` },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {isEditing ? "Editar" : "Agregar"} Estudiante - Familia {getFamilyName()}
              </h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </div>

            <Alert className="border-orange-200 bg-orange-50 mb-4">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-700">
                Es importante que sus datos de estudiante estén actualizados para una mejor comunicación.
              </AlertDescription>
            </Alert>

            <div className="flex items-start gap-2 p-4 bg-muted/50 rounded-lg">
              <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Importante:</p>
                <p className="text-sm text-muted-foreground">
                  Lea cuidadosamente cada campo antes de completarlo. Es fundamental ingresar la información de manera clara y precisa para garantizar la correcta gestión de los datos y el adecuado registro en el sistema.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Photo Card */}
        <Card>
          <CardHeader>
            <CardTitle>Foto del Estudiante</CardTitle>
            <CardDescription>
              Por favor, suba la foto de perfil del estudiante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <PhotoUpload
                  value={existingStudent?.photo_url}
                  onChange={setPhotoBlob}
                  label="Ingrese la foto de perfil"
                />
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Dynamic Grouped Fields */}
        {isStudentDataReady ? (
          <GroupedFormFields
            key={isEditing ? existingStudent?.id : 'new'}
            fields={formFields}
            groups={formGroups}
            formData={formData}
            onFieldChange={handleFieldChange}
            initialStateId={family?.state_id}
            initialMunicipalityId={family?.municipality_id}
            initialCityId={family?.city_id}
            initialParishId={family?.parish_id}
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Cargando datos del estudiante...</p>
            </CardContent>
          </Card>
        )}

        {/* Submit Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => window.history.back()}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "Guardar Y Continuar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </DashboardLayout>
  );
}
