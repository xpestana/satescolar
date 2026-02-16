import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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

export default function RepAddStudent() {
  const { studentId } = useParams<{ studentId?: string }>();
  const navigate = useNavigate();
  const { familyId, familyName, schoolId } = useRepresentativeFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!studentId;
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
    queryKey: ["form-fields", schoolId, "student"],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_fields").select("*").eq("school_id", schoolId).eq("form_type", "student").eq("is_visible", true).order("field_order");
      if (error) throw error; return data as FormField[];
    },
    enabled: !!schoolId,
  });

  const { data: formGroups = [] } = useQuery({
    queryKey: ["form-field-groups", schoolId, "student"],
    queryFn: async () => {
      const { data, error } = await supabase.from("form_field_groups").select("*").eq("school_id", schoolId).eq("form_type", "student").order("display_order");
      if (error) throw error; return data as FormFieldGroup[];
    },
    enabled: !!schoolId,
  });

  const { data: existingStudent } = useQuery({
    queryKey: ["student", studentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("id", studentId).single();
      if (error) throw error; return data;
    },
    enabled: !!studentId,
  });

  useEffect(() => { setFormData({}); setFormDataInitialized(false); setPhotoBlob(null); }, [studentId]);
  useEffect(() => {
    if (existingStudent && !formDataInitialized) { setFormData(existingStudent.form_data as Record<string, any> || {}); setFormDataInitialized(true); }
  }, [existingStudent, formDataInitialized]);

  const isStudentDataReady = !isEditing || (!!existingStudent && formDataInitialized);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = existingStudent?.photo_url || null;
      if (photoBlob) {
        const fileName = `${familyId}/students/${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from("family-photos").upload(fileName, photoBlob);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("family-photos").getPublicUrl(fileName);
        photoUrl = urlData.publicUrl;
      }
      const documentType = formData.tipo_documento || "";
      const documentNum = formData.documento || formData.cedula || "";
      const documentId = documentType && documentNum ? `${documentType}-${documentNum}` : documentNum || null;
      const studentData = { family_id: familyId, photo_url: photoUrl, form_data: formData, document_id: documentId };
      if (isEditing) {
        const { error } = await supabase.from("students").update(studentData).eq("id", studentId);
        if (error) throw error;
      } else {
        const newId = crypto.randomUUID();
        const { error } = await supabase.from("students").insert({ id: newId, ...studentData });
        if (error) throw error;
        if (schoolId) {
          const { error: assocError } = await supabase.from("student_schools").insert({ student_id: newId, school_id: schoolId });
          if (assocError) throw assocError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", familyId] });
      toast({ title: isEditing ? "Estudiante actualizado" : "Estudiante agregado", description: isEditing ? "Los datos se han actualizado" : "El estudiante ha sido agregado" });
      navigate("/representative/estudiantes");
    },
    onError: () => { toast({ variant: "destructive", title: "Error", description: "No se pudo guardar" }); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoBlob && !existingStudent?.photo_url) { toast({ variant: "destructive", title: "Error", description: "La foto es obligatoria" }); return; }
    saveMutation.mutate();
  };

  return (
    <DashboardLayout>
      <PageHeader
        title={`${isEditing ? "Editar" : "Agregar"} Estudiante`}
        breadcrumbs={[{ label: "Dashboard", href: "/representative/dashboard" }, { label: "Estudiantes", href: "/representative/estudiantes" }, { label: isEditing ? "Editar" : "Agregar" }]}
      />
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{isEditing ? "Editar" : "Agregar"} Estudiante - Familia {familyName}</h2>
              <Button type="button" variant="ghost" onClick={() => navigate("/representative/estudiantes")}>
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
          <CardHeader><CardTitle>Foto del Estudiante</CardTitle><CardDescription>Suba la foto de perfil.</CardDescription></CardHeader>
          <CardContent>
            <div className="flex justify-center"><div className="w-full max-w-md">
              <PhotoUpload value={existingStudent?.photo_url} onChange={setPhotoBlob} label="Ingrese la foto de perfil" />
            </div></div>
          </CardContent>
        </Card>

        {isStudentDataReady ? (
          <GroupedFormFields key={isEditing ? existingStudent?.id : "new"} fields={formFields} groups={formGroups} formData={formData} onFieldChange={(n, v) => setFormData((p) => ({ ...p, [n]: v }))} initialStateId={family?.state_id} initialMunicipalityId={family?.municipality_id} initialCityId={family?.city_id} initialParishId={family?.parish_id} />
        ) : (
          <Card><CardContent className="pt-6"><p className="text-muted-foreground text-center">Cargando datos...</p></CardContent></Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Button type="button" variant="destructive" onClick={() => navigate("/representative/estudiantes")}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Guardando..." : "Guardar"}</Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </DashboardLayout>
  );
}
