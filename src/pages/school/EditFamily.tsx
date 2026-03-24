import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";

export default function EditFamily() {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [familyEmail, setFamilyEmail] = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [formData, setFormData] = useState({
    father_last_name: "",
    mother_last_name: "",
    contact_phone: "",
    state_id: "",
    municipality_id: "",
    city_id: "",
    parish_id: "",
    address: "",
    additional_phone: "",
    monthly_income: "",
    income_contributor: "",
    dependents_count: "",
    transport_companion: "",
    transport_method: "",
    parents_marital_status: "",
    religion: "",
    emergency_contact: "",
    property_ownership: "",
    housing_type: "",
    rooms_count: "",
    monthly_housing_payment: "",
    housing_sector: "",
    housing_details: "",
  });

  // Fetch family data
  const { data: family, isLoading } = useQuery({
    queryKey: ["family", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .eq("id", familyId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!familyId,
  });

  // Fetch states
  const { data: states } = useQuery({
    queryKey: ["states"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("states")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Use the actual values from formData or fall back to family data for initial load
  const effectiveStateId = formData.state_id || family?.state_id || "";
  const effectiveMunicipalityId = formData.municipality_id || family?.municipality_id || "";
  const effectiveCityId = formData.city_id || family?.city_id || "";
  const effectiveParishId = formData.parish_id || family?.parish_id || "";

  // Fetch municipalities
  const { data: municipalities } = useQuery({
    queryKey: ["municipalities", effectiveStateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("municipalities")
        .select("*")
        .eq("state_id", effectiveStateId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveStateId,
  });

  // Fetch cities
  const { data: cities } = useQuery({
    queryKey: ["cities", effectiveStateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cities")
        .select("*")
        .eq("state_id", effectiveStateId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveStateId,
  });

  // Fetch parishes
  const { data: parishes } = useQuery({
    queryKey: ["parishes", effectiveMunicipalityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("parishes")
        .select("*")
        .eq("municipality_id", effectiveMunicipalityId)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveMunicipalityId,
  });

  // Fetch family email
  useEffect(() => {
    if (family?.user_id) {
      supabase.functions.invoke("get-user-emails", {
        body: { userIds: [family.user_id] },
      }).then(({ data }) => {
        const email = data?.emails?.[family.user_id] || "";
        setFamilyEmail(email);
        setOriginalEmail(email);
      });
    }
  }, [family?.user_id]);

  // Load family data into form
  useEffect(() => {
    if (family) {
      setFormData({
        father_last_name: family.father_last_name || "",
        mother_last_name: family.mother_last_name || "",
        contact_phone: family.contact_phone || "",
        state_id: family.state_id || "",
        municipality_id: family.municipality_id || "",
        city_id: family.city_id || "",
        parish_id: family.parish_id || "",
        address: family.address || "",
        additional_phone: family.additional_phone || "",
        monthly_income: family.monthly_income?.toString() || "",
        income_contributor: family.income_contributor || "",
        dependents_count: family.dependents_count?.toString() || "",
        transport_companion: family.transport_companion || "",
        transport_method: family.transport_method || "",
        parents_marital_status: family.parents_marital_status || "",
        religion: family.religion || "",
        emergency_contact: family.emergency_contact || "",
        property_ownership: family.property_ownership || "",
        housing_type: family.housing_type || "",
        rooms_count: family.rooms_count?.toString() || "",
        monthly_housing_payment: family.monthly_housing_payment || "",
        housing_sector: family.housing_sector || "",
        housing_details: family.housing_details || "",
      });
    }
  }, [family]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("families")
        .update({
          father_last_name: data.father_last_name || null,
          mother_last_name: data.mother_last_name || null,
          contact_phone: data.contact_phone || null,
          state_id: data.state_id || null,
          municipality_id: data.municipality_id || null,
          city_id: data.city_id || null,
          parish_id: data.parish_id || null,
          address: data.address || null,
          additional_phone: data.additional_phone || null,
          monthly_income: data.monthly_income ? parseFloat(data.monthly_income) : null,
          income_contributor: data.income_contributor || null,
          dependents_count: data.dependents_count ? parseInt(data.dependents_count) : null,
          transport_companion: data.transport_companion || null,
          transport_method: data.transport_method || null,
          parents_marital_status: data.parents_marital_status || null,
          religion: data.religion || null,
          emergency_contact: data.emergency_contact || null,
          property_ownership: data.property_ownership || null,
          housing_type: data.housing_type || null,
          rooms_count: data.rooms_count ? parseInt(data.rooms_count) : null,
          monthly_housing_payment: data.monthly_housing_payment || null,
          housing_sector: data.housing_sector || null,
          housing_details: data.housing_details || null,
        })
        .eq("id", familyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["family", familyId] });
      queryClient.invalidateQueries({ queryKey: ["families"] });
      toast({
        title: "Familia actualizada",
        description: "Los datos de la familia se han guardado correctamente",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la familia",
      });
    },
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => {
      const newData = { ...prev, [field]: value };
      
      // Reset dependent fields when state changes
      if (field === "state_id") {
        newData.municipality_id = "";
        newData.city_id = "";
        newData.parish_id = "";
      }
      
      // Reset parish when municipality changes
      if (field === "municipality_id") {
        newData.parish_id = "";
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Update email if changed
    if (familyEmail && familyEmail !== originalEmail) {
      try {
        const { data, error } = await supabase.functions.invoke("update-family-email", {
          body: { family_id: familyId, new_email: familyEmail },
        });
        if (error || data?.error) {
          toast({
            variant: "destructive",
            title: "Error",
            description: data?.error || "No se pudo actualizar el correo electrónico",
          });
          return;
        }
        setOriginalEmail(familyEmail);
      } catch {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo actualizar el correo electrónico",
        });
        return;
      }
    }

    updateMutation.mutate(formData);
  };

  const getFamilyName = () => {
    if (formData.father_last_name || formData.mother_last_name) {
      return `${formData.father_last_name} ${formData.mother_last_name}`.trim();
    }
    return "Por definir";
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={`Editar Familia - ${getFamilyName()}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/school/dashboard" },
          { label: `Editar Familia - ${getFamilyName()}` },
        ]}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header Card */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Editar Familia</h2>
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
              Es importante que sus datos de la cuenta de la familia estén actualizados para una mejor comunicación.
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

        {/* Basic Data */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex justify-end mb-4">
            <h3 className="text-lg font-semibold">Actualizar Familia</h3>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Datos Básicos</h4>
            <p className="text-sm text-muted-foreground">
              Por favor, indique la cédula de identidad o la cédula estudiantil del estudiante. En caso de no contar con una, puede ingresar la cédula del representante legal.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="father_last_name">Primer Apellido del Padre</Label>
                <Input
                  id="father_last_name"
                  placeholder="Primer Apellido del Padre"
                  value={formData.father_last_name}
                  onChange={(e) => handleChange("father_last_name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mother_last_name">Segundo Apellido de la madre</Label>
                <Input
                  id="mother_last_name"
                  placeholder="Segundo Apellido de la madre"
                  value={formData.mother_last_name}
                  onChange={(e) => handleChange("mother_last_name", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Teléfono de contacto</Label>
                <Input
                  id="contact_phone"
                  placeholder="Teléfono de contacto"
                  value={formData.contact_phone}
                  onChange={(e) => handleChange("contact_phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="family_email">Correo electrónico de la familia</Label>
                <Input
                  id="family_email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={familyEmail}
                  onChange={(e) => setFamilyEmail(e.target.value)}
                />
              </div>
            </div>

        {/* Location */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h4 className="font-semibold mb-4">Ubicación del grupo familiar</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={effectiveStateId}
                onValueChange={(value) => handleChange("state_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  {states?.map((state) => (
                    <SelectItem key={state.id} value={state.id}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Municipio</Label>
              <Select
                value={effectiveMunicipalityId}
                onValueChange={(value) => handleChange("municipality_id", value)}
                disabled={!effectiveStateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar municipio" />
                </SelectTrigger>
                <SelectContent>
                  {municipalities?.map((mun) => (
                    <SelectItem key={mun.id} value={mun.id}>
                      {mun.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ciudad</Label>
              <Select
                value={effectiveCityId}
                onValueChange={(value) => handleChange("city_id", value)}
                disabled={!effectiveStateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ciudad" />
                </SelectTrigger>
                <SelectContent>
                  {cities?.map((city) => (
                    <SelectItem key={city.id} value={city.id}>
                      {city.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Parroquia</Label>
              <Select
                value={effectiveParishId}
                onValueChange={(value) => handleChange("parish_id", value)}
                disabled={!effectiveMunicipalityId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar parroquia" />
                </SelectTrigger>
                <SelectContent>
                  {parishes?.map((parish) => (
                    <SelectItem key={parish.id} value={parish.id}>
                      {parish.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección de la familia</Label>
              <Textarea
                id="address"
                placeholder="Dirección de la familia"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex justify-end mb-4">
            <h3 className="text-lg font-semibold">Información Adicional</h3>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Información Adicional</h4>

            <div className="space-y-2">
              <Label htmlFor="additional_phone">Telefono Familiar o Cercano</Label>
              <Input
                id="additional_phone"
                placeholder="Telefono Familiar o Cercano"
                value={formData.additional_phone}
                onChange={(e) => handleChange("additional_phone", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Income */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h4 className="font-semibold mb-4">Ingreso Familiar</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly_income">Ingreso mensual (referenciado en divisas BCV)</Label>
              <Input
                id="monthly_income"
                type="number"
                placeholder="Ingreso mensual"
                value={formData.monthly_income}
                onChange={(e) => handleChange("monthly_income", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="income_contributor">Aportado por:</Label>
              <Input
                id="income_contributor"
                placeholder="Aportado por"
                value={formData.income_contributor}
                onChange={(e) => handleChange("income_contributor", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dependents_count">Cantidad de personas que dependen del ingreso:</Label>
              <Input
                id="dependents_count"
                type="number"
                placeholder="Ingrese aquí"
                value={formData.dependents_count}
                onChange={(e) => handleChange("dependents_count", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Transport */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex justify-end mb-4">
            <h3 className="text-lg font-semibold">Transporte</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="transport_companion">Con quién llegan y se retiran los estudiantes del colegio</Label>
              <Textarea
                id="transport_companion"
                placeholder="Ingrese aquí"
                value={formData.transport_companion}
                onChange={(e) => handleChange("transport_companion", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Metodo de transporte</Label>
              <Select
                value={formData.transport_method}
                onValueChange={(value) => handleChange("transport_method", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Metodo de transporte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Transporte público">Transporte público</SelectItem>
                  <SelectItem value="Vehículo propio">Vehículo propio</SelectItem>
                  <SelectItem value="A pie">A pie</SelectItem>
                  <SelectItem value="Transporte escolar">Transporte escolar</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Social Aspects */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex justify-end mb-4">
            <h3 className="text-lg font-semibold">Aspectos sociales</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Estado civil de los padres</Label>
              <Select
                value={formData.parents_marital_status}
                onValueChange={(value) => handleChange("parents_marital_status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Estado civil de los padres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Matrimonio eclesiástico">Matrimonio eclesiástico</SelectItem>
                  <SelectItem value="Matrimonio civil">Matrimonio civil</SelectItem>
                  <SelectItem value="Concubinato">Concubinato</SelectItem>
                  <SelectItem value="Soltero/a">Soltero/a</SelectItem>
                  <SelectItem value="Divorciado/a">Divorciado/a</SelectItem>
                  <SelectItem value="Viudo/a">Viudo/a</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Religión</Label>
              <Select
                value={formData.religion}
                onValueChange={(value) => handleChange("religion", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Religión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Católica">Católica</SelectItem>
                  <SelectItem value="Evangélica">Evangélica</SelectItem>
                  <SelectItem value="Testigo de Jehová">Testigo de Jehová</SelectItem>
                  <SelectItem value="Mormón">Mormón</SelectItem>
                  <SelectItem value="Ninguna">Ninguna</SelectItem>
                  <SelectItem value="Otra">Otra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <Label htmlFor="emergency_contact">Nombre e informacion completa de la persona para casos de emergencia</Label>
            <Textarea
              id="emergency_contact"
              placeholder="Ingrese aquí"
              value={formData.emergency_contact}
              onChange={(e) => handleChange("emergency_contact", e.target.value)}
            />
          </div>
        </div>

        {/* Housing */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <h4 className="font-semibold mb-4">Detalles de la vivienda</h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Propiedad de la vivienda</Label>
              <Select
                value={formData.property_ownership}
                onValueChange={(value) => handleChange("property_ownership", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Propiedad de la vivienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Propia">Propia</SelectItem>
                  <SelectItem value="Alquilada">Alquilada</SelectItem>
                  <SelectItem value="Prestada">Prestada</SelectItem>
                  <SelectItem value="Familiar">Familiar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de vivienda familiar</Label>
              <Select
                value={formData.housing_type}
                onValueChange={(value) => handleChange("housing_type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de vivienda familiar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Casa">Casa</SelectItem>
                  <SelectItem value="Apartamento">Apartamento</SelectItem>
                  <SelectItem value="Quinta">Quinta</SelectItem>
                  <SelectItem value="Rancho">Rancho</SelectItem>
                  <SelectItem value="Habitación">Habitación</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rooms_count">Numero de habitaciones</Label>
              <Input
                id="rooms_count"
                type="number"
                placeholder="Numero de habitaciones"
                value={formData.rooms_count}
                onChange={(e) => handleChange("rooms_count", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Pago mensual por la vivienda</Label>
              <Select
                value={formData.monthly_housing_payment}
                onValueChange={(value) => handleChange("monthly_housing_payment", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pago mensual por la vivienda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Menos de 100$">Menos de 100$</SelectItem>
                  <SelectItem value="Entre 100$ y 200$">Entre 100$ y 200$</SelectItem>
                  <SelectItem value="Entre 200$ y 300$">Entre 200$ y 300$</SelectItem>
                  <SelectItem value="Entre 300$ y 400$">Entre 300$ y 400$</SelectItem>
                  <SelectItem value="Más de 400$">Más de 400$</SelectItem>
                  <SelectItem value="No aplica">No aplica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Su vivienda esta ubicada en un sector:</Label>
              <Select
                value={formData.housing_sector}
                onValueChange={(value) => handleChange("housing_sector", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Su vivienda esta ubicada en un sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Urbano">Urbano</SelectItem>
                  <SelectItem value="Rural">Rural</SelectItem>
                  <SelectItem value="Semi-urbano">Semi-urbano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="housing_details">Otros detalles de la vivienda</Label>
              <Textarea
                id="housing_details"
                placeholder="Ingrese aquí"
                value={formData.housing_details}
                onChange={(e) => handleChange("housing_details", e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="bg-card rounded-lg shadow-sm border p-6">
          <div className="flex justify-end mb-4">
            <h3 className="text-lg font-semibold">Guardar y continuar</h3>
          </div>

          <p className="font-medium mb-4">
            Doy fé de que los datos ingresados son correctos y que el estudiante es de mi conocimiento.
          </p>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={() => window.history.back()}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Guardando..." : "Guardar Y Continuar"}
            </Button>
          </div>
        </div>
      </form>
    </DashboardLayout>
  );
}
