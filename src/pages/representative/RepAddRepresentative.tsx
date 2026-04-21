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
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/families/PhotoUpload";
import { GroupedFormFields } from "@/components/forms/GroupedFormFields";
import type { Json } from "@/integrations/supabase/types";

interface FormField {
  id: string; field_name: string; field_label: string; field_type: string;
  is_required: boolean; is_visible: boolean; placeholder: string | null;
  options: Json | null; field_order: number; group_id: string | null;
}
interface FormFieldGroup { id: string; name: string; description: string | null; display_order: number; }

export default function RepAddRepresentative() {
  const { representativeId } = useParams<{ representativeId?: string }>();
  const navigate = useNavigate();
  const { familyId, familyName, schoolId } = useRepresentativeFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!representativeId;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formDataInitialized, setFormDataInitialized] = useState(false);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const { data: family } = useQuery({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("father_last_name, mother_last_name, state_id, municipality_id, city_id, parish_id").eq("id", familyId).single();
      if (error) throw error; return data;
    },
    enabled: !!familyId,
  });

  const { data: formFields = [] } = useQuery({
    queryKey: ["form-fields", schoolId, "representative"],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_fields").select("*").eq("school_id", schoolId).eq("form_type", "representative").eq("is_visible", true).order("field_order");
      if (error) throw error; return data as FormField[];
    },
    enabled: !!schoolId,
  });

  const { data: formGroups = [] } = useQuery({
    queryKey: ["form-field-groups", schoolId, "representative"],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_field_groups").select("*").eq("school_id", schoolId).eq("form_type", "representative").order("display_order");
      if (error) throw error; return data as FormFieldGroup[];
    },
    enabled: !!schoolId,
  });

  const { data: existingRep } = useQuery({
    queryKey: ["representative", representativeId],
    queryFn: async () => {
      const { data, error } = await supabase.from("representatives").select("*").eq("id", representativeId).single();
      if (error) throw error; return data;
    },
    enabled: !!representativeId,
  });

  useEffect(() => { setFormData({}); setFormDataInitialized(false); setPhotoBlob(null); }, [representativeId]);
  useEffect(() => {
    if (existingRep && !formDataInitialized) { setFormData(existingRep.form_data as Record<string, any> || {}); setFormDataInitialized(true); }
  }, [existingRep, formDataInitialized]);

  const isRepDataReady = !isEditing || (!!existingRep && formDataInitialized);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = existingRep?.photo_url || null;
      const repIdForUpload = isEditing ? representativeId! : crypto.randomUUID();
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
      const documentType = formData.tipo_documento || "";
      const documentNum = formData.documento || "";
      const documentId = documentType && documentNum ? `${documentType}-${documentNum}` : documentNum || null;
      const repData = {
        family_id: familyId, photo_url: photoUrl, form_data: formData, document_id: documentId,
        phone: formData.numero_contacto || formData.telefono || null,
        email: formData.email || formData.correo || formData.correo_electronico || null,
      };
      if (isEditing) {
        const { error } = await supabase.from("representatives").update(repData).eq("id", representativeId);
        if (error) throw error;
      } else {
        // Check if this is the first representative for the family
        const { count } = await supabase.from("representatives").select("id", { count: "exact", head: true }).eq("family_id", familyId!);
        const isFirst = (count || 0) === 0;
        const { error } = await supabase.from("representatives").insert({ id: repIdForUpload, ...repData, is_primary: isFirst });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["representatives", familyId] });
      toast({ title: isEditing ? "Representante actualizado" : "Representante agregado", description: isEditing ? "Los datos se han actualizado correctamente" : "El representante ha sido agregado" });
      navigate("/representative/representantes");
    },
    onError: () => { toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el representante" }); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBlob && !existingRep?.photo_url) { toast({ variant: "destructive", title: "Error", description: "La foto es obligatoria" }); return; }
    saveMutation.mutate();
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={`${isEditing ? "Editar" : "Agregar"} Representante`}
        breadcrumbs={[{ label: "Dashboard", href: "/representative/dashboard" }, { label: "Representantes", href: "/representative/representantes" }, { label: isEditing ? "Editar" : "Agregar" }]}
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{isEditing ? "Editar" : "Agregar"} Representante - Familia {familyName}</h2>
              <Button type="button" variant="ghost" onClick={() => navigate("/representative/representantes")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver
              </Button>
            </div>
            <Alert className="border-orange-200 bg-orange-50 mb-4">
              <AlertCircle className="h-4 w-4 text-orange-500" />
              <AlertDescription className="text-orange-700">Es importante que sus datos estén actualizados.</AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Foto del Representante</CardTitle><CardDescription>Suba la foto de perfil.</CardDescription></CardHeader>
          <CardContent>
            <div className="flex justify-center"><div className="w-full max-w-md">
              <PhotoUpload value={existingRep?.photo_url} onChange={setPhotoBlob} label="Ingrese la foto de perfil" />
            </div></div>
          </CardContent>
        </Card>

        {isRepDataReady ? (
          <GroupedFormFields key={isEditing ? existingRep?.id : "new"} fields={formFields} groups={formGroups} formData={formData} onFieldChange={(n, v) => setFormData((p) => ({ ...p, [n]: v }))} initialStateId={family?.state_id} initialMunicipalityId={family?.municipality_id} initialCityId={family?.city_id} initialParishId={family?.parish_id} />
        ) : (
          <Card><CardContent className="pt-6"><p className="text-muted-foreground text-center">Cargando datos...</p></CardContent></Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button type="button" variant="destructive" onClick={() => navigate("/representative/representantes")}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </DashboardLayout>
  );
}
