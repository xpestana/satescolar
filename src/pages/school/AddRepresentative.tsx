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

export default function AddRepresentative() {
  const { familyId, representativeId } = useParams<{ familyId: string; representativeId?: string }>();
  const navigate = useNavigate();
  const { schoolId } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!representativeId;
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

  // Fetch form fields for representative form
  const { data: formFields = [] } = useQuery({
    queryKey: ["form-fields", schoolId, "representative"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_fields")
        .select("*")
        .eq("school_id", schoolId)
        .eq("form_type", "representative")
        .eq("is_visible", true)
        .order("field_order");
      if (error) throw error;
      return data as FormField[];
    },
    enabled: !!schoolId,
  });

  // Fetch form field groups
  const { data: formGroups = [] } = useQuery({
    queryKey: ["form-field-groups", schoolId, "representative"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_field_groups")
        .select("*")
        .eq("school_id", schoolId)
        .eq("form_type", "representative")
        .order("display_order");
      if (error) throw error;
      return data as FormFieldGroup[];
    },
    enabled: !!schoolId,
  });

  // Fetch existing representative data if editing
  const { data: existingRep } = useQuery({
    queryKey: ["representative", representativeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("representatives")
        .select("*")
        .eq("id", representativeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!representativeId,
  });

  // Reset form state when representativeId changes
  useEffect(() => {
    setFormData({});
    setFormDataInitialized(false);
    setPhotoBlob(null);
  }, [representativeId]);

  // Load existing data when editing
  useEffect(() => {
    if (existingRep && !formDataInitialized) {
      setFormData(existingRep.form_data as Record<string, any> || {});
      setFormDataInitialized(true);
    }
  }, [existingRep, formDataInitialized]);

  // Don't render form until rep data is loaded AND formData is initialized
  const isRepDataReady = !isEditing || (!!existingRep && formDataInitialized);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = existingRep?.photo_url || null;

      // Generate ID upfront so the S3 path can scope under representatives/<id>/
      const repIdForUpload = isEditing ? representativeId! : crypto.randomUUID();

      // Upload photo to AWS S3 if provided
      if (photoBlob && schoolId) {
        const result = await uploadToS3({
          file: photoBlob,
          folder: "representatives",
          schoolId,
          entityId: repIdForUpload,
          fileName: `${Date.now()}.png`,
        });
        photoUrl = result.publicUrl;
      }

      // Extract known fields from form_data to sync direct columns
      const documentType = formData.tipo_documento || "";
      let documentNum = formData.documento || "";
      // Strip any existing type prefix to avoid duplication (e.g., "V-12345" with tipo "E" → "E-12345")
      if (documentType && documentNum) {
        documentNum = documentNum.replace(/^(V-|E-|CE-|P-)/i, "");
      }
      const documentId = documentType && documentNum ? `${documentType}-${documentNum}` : documentNum || null;

      const repData = {
        family_id: familyId,
        photo_url: photoUrl,
        form_data: formData,
        document_id: documentId,
        phone: formData.numero_contacto || formData.telefono || null,
        email: formData.email || formData.correo || formData.correo_electronico || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("representatives")
          .update(repData)
          .eq("id", representativeId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("representatives")
          .insert({ id: repIdForUpload, ...repData });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["representatives", familyId] });
      toast({
        title: isEditing ? "Representante actualizado" : "Representante agregado",
        description: isEditing
          ? "Los datos del representante se han actualizado correctamente"
          : "El representante ha sido agregado a la familia",
      });
      window.history.back();
    },
    onError: (error) => {
      console.error("Error saving representative:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar el representante",
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

    if (isPhotoRequired && !photoBlob && !existingRep?.photo_url) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "La foto del representante es obligatoria",
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
        title={`${isEditing ? "Editar" : "Agregar"} Representante - Familia ${getFamilyName()}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/school/dashboard" },
          { label: `${isEditing ? "Editar" : "Agregar"} Representante - Familia ${getFamilyName()}` },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {isEditing ? "Editar" : "Agregar"} Representante - Familia {getFamilyName()}
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
                Es importante que sus datos de representante estén actualizados para una mejor comunicación.
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
            <CardTitle>Foto del Representante</CardTitle>
            <CardDescription>
              Por favor, suba la foto de perfil del representante.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <div className="w-full max-w-md">
                <PhotoUpload
                  value={existingRep?.photo_url}
                  onChange={setPhotoBlob}
                  label="Ingrese la foto de perfil"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Dynamic Grouped Fields */}
        {isRepDataReady ? (
          <GroupedFormFields
            key={isEditing ? existingRep?.id : 'new'}
            fields={visibleFormFields}
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
              <p className="text-muted-foreground text-center">Cargando datos del representante...</p>
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
