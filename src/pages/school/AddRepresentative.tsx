import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, AlertCircle, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/families/PhotoUpload";
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
}

export default function AddRepresentative() {
  const { familyId, representativeId } = useParams<{ familyId: string; representativeId?: string }>();
  const navigate = useNavigate();
  const { schoolId } = useSchoolId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEditing = !!representativeId;
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Fetch family name
  const { data: family } = useQuery({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("father_last_name, mother_last_name")
        .eq("id", familyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  // Fetch form fields for representative form
  const { data: formFields } = useQuery({
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

  // Load existing data when editing
  useEffect(() => {
    if (existingRep) {
      setFormData(existingRep.form_data as Record<string, any> || {});
      setDocumentId(existingRep.document_id || "");
      setPhone(existingRep.phone || "");
      setEmail(existingRep.email || "");
    }
  }, [existingRep]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = existingRep?.photo_url || null;

      // Upload photo if provided
      if (photoBlob) {
        const fileName = `${familyId}/representatives/${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage
          .from("family-photos")
          .upload(fileName, photoBlob);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("family-photos")
          .getPublicUrl(fileName);

        photoUrl = urlData.publicUrl;
      }

      const repData = {
        family_id: familyId,
        school_id: schoolId,
        photo_url: photoUrl,
        document_id: documentId || null,
        phone: phone || null,
        email: email || null,
        form_data: formData,
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
          .insert(repData);
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
      navigate(`/registros/familias`);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check required photo
    if (!photoBlob && !existingRep?.photo_url) {
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

  const renderField = (field: FormField) => {
    const value = formData[field.field_name] || "";

    switch (field.field_type) {
      case "textarea":
        return (
          <Textarea
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
          />
        );
      case "select":
        const options = Array.isArray(field.options) ? field.options : [];
        return (
          <Select
            value={value}
            onValueChange={(val) => handleFieldChange(field.field_name, val)}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || field.field_label} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt: any, idx: number) => (
                <SelectItem key={idx} value={String(opt)}>
                  {String(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "checkbox":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.field_name}
              checked={!!value}
              onCheckedChange={(checked) => handleFieldChange(field.field_name, checked)}
            />
            <label htmlFor={field.field_name} className="text-sm">
              {field.field_label}
            </label>
          </div>
        );
      case "date":
        return (
          <Input
            type="date"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
          />
        );
      case "email":
        return (
          <Input
            type="email"
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
          />
        );
      case "phone":
        return (
          <Input
            type="tel"
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
          />
        );
      default:
        return (
          <Input
            type="text"
            placeholder={field.placeholder || field.field_label}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
          />
        );
    }
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
        {/* Header */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {isEditing ? "Editar" : "Agregar"} Representante - Familia {getFamilyName()}
            </h2>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/registros/familias")}
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
        </div>

        {/* Representative Form */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">
            {isEditing ? "Modificar Representante" : "Nuevo Representante"}
          </h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-semibold mb-2">Datos Básicos</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Por favor, complete los datos del representante.
              </p>

              {/* Photo Upload */}
              <div className="flex justify-center mb-6">
                <div className="w-full max-w-md">
                  <PhotoUpload
                    value={existingRep?.photo_url}
                    onChange={setPhotoBlob}
                    label="Ingrese la foto de perfil"
                  />
                </div>
              </div>

              {/* Base fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="document_id">Documento de Identidad</Label>
                  <Input
                    id="document_id"
                    placeholder="Cédula o documento"
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Teléfono"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Dynamic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {formFields?.map((field) => (
                  <div key={field.id} className="space-y-2">
                    {field.field_type !== "checkbox" && (
                      <Label htmlFor={field.field_name}>
                        {field.field_label}
                        {field.is_required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                    )}
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => navigate("/registros/familias")}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando..." : "Guardar Y Continuar"}
            </Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
