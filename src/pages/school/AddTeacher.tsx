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
import { uploadToS3 } from "@/lib/s3-upload";
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

export default function AddTeacher() {
  const { teacherId } = useParams<{ teacherId?: string }>();
  const navigate = useNavigate();
  const { schoolId } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!teacherId;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formDataInitialized, setFormDataInitialized] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  // Fetch form fields for teacher form
  const { data: formFields = [] } = useQuery({
    queryKey: ["form-fields", schoolId, "teacher"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .eq("school_id", schoolId)
        .eq("form_type", "teacher")
        .eq("is_visible", true)
        .order("field_order");
      if (error) throw error;
      return data as FormField[];
    },
    enabled: !!schoolId,
  });

  // Fetch form field groups
  const { data: formGroups = [] } = useQuery({
    queryKey: ["form-field-groups", schoolId, "teacher"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_field_groups")
        .select("*")
        .eq("school_id", schoolId)
        .eq("form_type", "teacher")
        .order("display_order");
      if (error) throw error;
      return data as FormFieldGroup[];
    },
    enabled: !!schoolId,
  });

  // Fetch existing teacher data if editing
  const { data: existingTeacher } = useQuery({
    queryKey: ["teacher", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("*")
        .eq("id", teacherId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!teacherId,
  });

  useEffect(() => {
    setFormData({});
    setFormDataInitialized(false);
    setPhotoBlob(null);
  }, [teacherId]);

  useEffect(() => {
    if (existingTeacher && !formDataInitialized) {
      setFormData(existingTeacher.form_data as Record<string, any> || {});
      setFormDataInitialized(true);
    }
  }, [existingTeacher, formDataInitialized]);

  const isDataReady = !isEditing || (!!existingTeacher && formDataInitialized);

  // Find email and phone field names dynamically from form fields
  const emailFieldName = formFields.find(f => 
    f.field_name === 'correo_electronico' || f.field_name === 'email'
  )?.field_name || 'correo_electronico';
  
  const phoneFieldName = formFields.find(f => 
    f.field_name === 'numero_contacto' || f.field_name === 'telefono' || f.field_name === 'celular'
  )?.field_name || 'numero_contacto';

  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = existingTeacher?.photo_url || null;

      if (photoBlob && schoolId) {
        // For edit mode use teacherId; for create we don't have one yet —
        // use a temporary uuid; create-teacher edge function will store the url as-is
        const entityId = isEditing ? teacherId! : crypto.randomUUID();
        const result = await uploadToS3({
          file: photoBlob,
          folder: "teachers",
          schoolId,
          entityId,
          fileName: `${Date.now()}.png`,
        });
        photoUrl = result.publicUrl;
      }

      const documentType = formData.tipo_documento || "";
      const documentNum = formData.documento || "";
      const documentId = documentType && documentNum ? `${documentType}-${documentNum}` : documentNum || null;

      const resolvedEmail = formData[emailFieldName] || null;
      const resolvedPhone = formData[phoneFieldName] || null;

      if (isEditing) {
        const teacherData = {
          school_id: schoolId,
          photo_url: photoUrl,
          form_data: formData,
          document_id: documentId,
          phone: resolvedPhone,
          email: resolvedEmail,
        };
        const { error } = await supabase
          .from("teachers")
          .update(teacherData)
          .eq("id", teacherId);
        if (error) throw error;
      } else {
        // Use edge function to create user + role + teacher record
        const email = resolvedEmail;
        if (!email) throw new Error("El correo electrónico es obligatorio para crear el docente");
        if (!documentId) throw new Error("El número de documento es obligatorio para crear el docente");
        const response = await supabase.functions.invoke("create-teacher", {
          body: {
            email,
            form_data: formData,
            photo_url: photoUrl,
            document_id: documentId,
            phone: resolvedPhone,
          },
        });

        if (response.error) throw new Error(response.error.message || "Error al crear el docente");
        const result = response.data;
        if (result?.error) throw new Error(result.error);

        // Show the temporary password message
        if (result?.message) {
          toast({
            title: "Docente creado",
            description: result.message,
            duration: 10000,
          });
          return; // Skip the onSuccess toast since we already showed one
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers", schoolId] });
      toast({
        title: isEditing ? "Docente actualizado" : "Docente agregado",
        description: isEditing
          ? "Los datos del docente se han actualizado correctamente"
          : "El docente ha sido agregado correctamente",
      });
      navigate("/registros/docentes");
    },
    onError: (error) => {
      console.error("Error saving teacher:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el docente",
      });
    },
  });

  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
  };

  const isPhotoRequired = formFields.find((f) => f.field_name === "foto_perfil")?.is_required ?? true;
  const visibleFormFields = formFields.filter((f) => f.field_name !== "foto_perfil");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isPhotoRequired && !photoBlob && !existingTeacher?.photo_url) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La foto del docente es obligatoria",
      });
      return;
    }

    saveMutation.mutate();
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={`${isEditing ? "Editar" : "Agregar"} Docente`}
        breadcrumbs={[
          { label: "Registros" },
          { label: "Docentes", href: "/registros/docentes" },
          { label: isEditing ? "Editar" : "Agregar" },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {isEditing ? "Editar" : "Agregar"} Docente
              </h2>
              <Button type="button" variant="ghost" onClick={() => navigate("/registros/docentes")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </div>

            <Alert className="border-orange-200 bg-orange-50 mb-4">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-700">
                Es importante que los datos del docente estén actualizados para una mejor gestión institucional.
              </AlertDescription>
            </Alert>

            <div className="flex items-start gap-2 p-4 bg-muted/50 rounded-lg">
              <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Importante:</p>
                <p className="text-sm text-muted-foreground">
                  Lea cuidadosamente cada campo antes de completarlo. Es fundamental ingresar la información de manera clara y precisa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Foto del Docente</CardTitle>
            <CardDescription>Por favor, suba la foto de perfil del docente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <PhotoUpload
                  value={existingTeacher?.photo_url}
                  onChange={setPhotoBlob}
                  label="Ingrese la foto de perfil"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isDataReady ? (
          <GroupedFormFields
            key={isEditing ? existingTeacher?.id : 'new'}
            fields={visibleFormFields}
            groups={formGroups}
            formData={formData}
            onFieldChange={handleFieldChange}
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Cargando datos del docente...</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button type="button" variant="destructive" onClick={() => navigate("/registros/docentes")}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </DashboardLayout>
  );
}
