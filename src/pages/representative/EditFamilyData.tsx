import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRepresentativeFamily } from "@/hooks/useRepresentativeFamily";
import { useToast } from "@/hooks/use-toast";

export default function EditFamilyData() {
  const { familyId, familyName } = useRepresentativeFamily();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    father_last_name: "", mother_last_name: "", contact_phone: "",
    state_id: "", municipality_id: "", city_id: "", parish_id: "",
    address: "", additional_phone: "", monthly_income: "",
    income_contributor: "", dependents_count: "", transport_companion: "",
    transport_method: "", parents_marital_status: "", religion: "",
    emergency_contact: "", property_ownership: "", housing_type: "",
    rooms_count: "", monthly_housing_payment: "", housing_sector: "", housing_details: "",
  });

  const { data: family, isLoading } = useQuery({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("*").eq("id", familyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  const { data: states } = useQuery({
    queryKey: ["states"],
    queryFn: async () => { const { data } = await supabase.from("states").select("*").order("name"); return data; },
  });

  const effectiveStateId = formData.state_id || family?.state_id || "";
  const effectiveMunicipalityId = formData.municipality_id || family?.municipality_id || "";

  const { data: municipalities } = useQuery({
    queryKey: ["municipalities", effectiveStateId],
    queryFn: async () => { const { data } = await supabase.from("municipalities").select("*").eq("state_id", effectiveStateId).order("name"); return data; },
    enabled: !!effectiveStateId,
  });

  const { data: cities } = useQuery({
    queryKey: ["cities", effectiveStateId],
    queryFn: async () => { const { data } = await supabase.from("cities").select("*").eq("state_id", effectiveStateId).order("name"); return data; },
    enabled: !!effectiveStateId,
  });

  const { data: parishes } = useQuery({
    queryKey: ["parishes", effectiveMunicipalityId],
    queryFn: async () => { const { data } = await supabase.from("parishes").select("*").eq("municipality_id", effectiveMunicipalityId).order("name"); return data; },
    enabled: !!effectiveMunicipalityId,
  });

  useEffect(() => {
    if (family) {
      setFormData({
        father_last_name: family.father_last_name || "", mother_last_name: family.mother_last_name || "",
        contact_phone: family.contact_phone || "", state_id: family.state_id || "",
        municipality_id: family.municipality_id || "", city_id: family.city_id || "",
        parish_id: family.parish_id || "", address: family.address || "",
        additional_phone: family.additional_phone || "", monthly_income: family.monthly_income?.toString() || "",
        income_contributor: family.income_contributor || "", dependents_count: family.dependents_count?.toString() || "",
        transport_companion: family.transport_companion || "", transport_method: family.transport_method || "",
        parents_marital_status: family.parents_marital_status || "", religion: family.religion || "",
        emergency_contact: family.emergency_contact || "", property_ownership: family.property_ownership || "",
        housing_type: family.housing_type || "", rooms_count: family.rooms_count?.toString() || "",
        monthly_housing_payment: family.monthly_housing_payment || "", housing_sector: family.housing_sector || "",
        housing_details: family.housing_details || "",
      });
    }
  }, [family]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("families").update({
        father_last_name: data.father_last_name || null, mother_last_name: data.mother_last_name || null,
        contact_phone: data.contact_phone || null, state_id: data.state_id || null,
        municipality_id: data.municipality_id || null, city_id: data.city_id || null,
        parish_id: data.parish_id || null, address: data.address || null,
        additional_phone: data.additional_phone || null,
        monthly_income: data.monthly_income ? parseFloat(data.monthly_income) : null,
        income_contributor: data.income_contributor || null,
        dependents_count: data.dependents_count ? parseInt(data.dependents_count) : null,
        transport_companion: data.transport_companion || null, transport_method: data.transport_method || null,
        parents_marital_status: data.parents_marital_status || null, religion: data.religion || null,
        emergency_contact: data.emergency_contact || null, property_ownership: data.property_ownership || null,
        housing_type: data.housing_type || null,
        rooms_count: data.rooms_count ? parseInt(data.rooms_count) : null,
        monthly_housing_payment: data.monthly_housing_payment || null, housing_sector: data.housing_sector || null,
        housing_details: data.housing_details || null,
      }).eq("id", familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
      toast({ title: "Familia actualizada", description: "Los datos se han guardado correctamente" });
    },
    onError: () => { toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar" }); },
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const n = { ...prev, [field]: value };
      if (field === "state_id") { n.municipality_id = ""; n.city_id = ""; n.parish_id = ""; }
      if (field === "municipality_id") { n.parish_id = ""; }
      return n;
    });
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); updateMutation.mutate(formData); };

  if (isLoading || !familyId) {
    return <DashboardLayout><div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Cargando...</p></div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <PageHeader title={`Datos de Familia - ${familyName}`} breadcrumbs={[{ label: "Dashboard", href: "/representative/dashboard" }, { label: "Datos de Familia" }]} />
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <Alert className="border-orange-200 bg-orange-50 mb-4">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <AlertDescription className="text-orange-700">Es importante que sus datos de la cuenta de la familia estén actualizados para una mejor comunicación.</AlertDescription>
          </Alert>
          <div className="flex items-start gap-2 p-4 bg-muted/50 rounded-lg">
            <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="font-medium">Importante:</p>
              <p className="text-sm text-muted-foreground">Lea cuidadosamente cada campo antes de completarlo.</p>
            </div>
          </div>
        </div>

        {/* Basic Data */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h4 className="font-semibold mb-4">Datos Básicos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primer Apellido del Padre</Label>
              <Input value={formData.father_last_name} onChange={(e) => handleChange("father_last_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Segundo Apellido de la Madre</Label>
              <Input value={formData.mother_last_name} onChange={(e) => handleChange("mother_last_name", e.target.value)} />
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <Label>Teléfono de contacto</Label>
            <Input value={formData.contact_phone} onChange={(e) => handleChange("contact_phone", e.target.value)} />
          </div>
        </div>

        {/* Location */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h4 className="font-semibold mb-4">Ubicación del grupo familiar</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={formData.state_id || effectiveStateId} onValueChange={(v) => handleChange("state_id", v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{states?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Municipio</Label>
              <Select value={formData.municipality_id || effectiveMunicipalityId} onValueChange={(v) => handleChange("municipality_id", v)} disabled={!effectiveStateId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{municipalities?.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Select value={formData.city_id} onValueChange={(v) => handleChange("city_id", v)} disabled={!effectiveStateId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{cities?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Parroquia</Label>
              <Select value={formData.parish_id} onValueChange={(v) => handleChange("parish_id", v)} disabled={!effectiveMunicipalityId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{parishes?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Textarea value={formData.address} onChange={(e) => handleChange("address", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Additional */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h4 className="font-semibold mb-4">Información Adicional</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Teléfono Familiar o Cercano</Label>
              <Input value={formData.additional_phone} onChange={(e) => handleChange("additional_phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Contacto de Emergencia</Label>
              <Input value={formData.emergency_contact} onChange={(e) => handleChange("emergency_contact", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Income */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h4 className="font-semibold mb-4">Ingreso Familiar</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Ingreso mensual</Label>
              <Input type="number" value={formData.monthly_income} onChange={(e) => handleChange("monthly_income", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Aportado por</Label>
              <Input value={formData.income_contributor} onChange={(e) => handleChange("income_contributor", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Personas a cargo</Label>
              <Input type="number" value={formData.dependents_count} onChange={(e) => handleChange("dependents_count", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
