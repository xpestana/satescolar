import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowLeft, Upload } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageCropModal } from "@/components/ImageCropModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const institutionTypes = [
  { value: "public", label: "Público" },
  { value: "private", label: "Privado" },
  { value: "subsidized", label: "Subvencionado" },
  { value: "other", label: "Otro" },
];

const schoolSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200, "Máximo 200 caracteres"),
  phone: z.string().min(1, "El teléfono es requerido").max(20, "Máximo 20 caracteres"),
  address: z.string().min(1, "La dirección es requerida").max(500, "Máximo 500 caracteres"),
  dea_code: z.string().min(1, "El código DEA es requerido").max(50, "Máximo 50 caracteres"),
  email: z.string().email("Email inválido").max(100, "Máximo 100 caracteres"),
  url: z.string().url("URL inválida").optional().or(z.literal("")),
  statistical_code: z.string().min(1, "El código estadístico es requerido").max(50, "Máximo 50 caracteres"),
  rif: z.string().min(1, "El RIF es requerido").max(20, "Máximo 20 caracteres"),
  institution_type: z.enum(["public", "private", "subsidized", "other"]),
  fax: z.string().max(20, "Máximo 20 caracteres").optional().or(z.literal("")),
  state_id: z.string().optional(),
  municipality_id: z.string().optional(),
  city_id: z.string().optional(),
  parish_id: z.string().optional(),
});

type SchoolFormValues = z.infer<typeof schoolSchema>;

interface LocationOption {
  id: string;
  name: string;
}

export default function SchoolForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState<LocationOption[]>([]);
  const [municipalities, setMunicipalities] = useState<LocationOption[]>([]);
  const [cities, setCities] = useState<LocationOption[]>([]);
  const [parishes, setParishes] = useState<LocationOption[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoBlob, setLogoBlob] = useState<Blob | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const form = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      dea_code: "",
      email: "",
      url: "",
      statistical_code: "",
      rif: "",
      institution_type: "private",
      fax: "",
      state_id: "",
      municipality_id: "",
      city_id: "",
      parish_id: "",
    },
  });

  // Fetch states on mount
  useEffect(() => {
    const fetchStates = async () => {
      const { data } = await supabase
        .from("states")
        .select("id, name")
        .order("name");
      setStates(data || []);
    };
    fetchStates();
  }, []);

  // Fetch municipalities when state changes
  const fetchMunicipalities = useCallback(async (stateId: string) => {
    if (!stateId) {
      setMunicipalities([]);
      return;
    }
    const { data } = await supabase
      .from("municipalities")
      .select("id, name")
      .eq("state_id", stateId)
      .order("name");
    setMunicipalities(data || []);
  }, []);

  // Fetch cities when municipality changes
  const fetchCities = useCallback(async (municipalityId: string) => {
    if (!municipalityId) {
      setCities([]);
      return;
    }
    const { data } = await supabase
      .from("cities")
      .select("id, name")
      .eq("municipality_id", municipalityId)
      .order("name");
    setCities(data || []);
  }, []);

  // Fetch parishes when city changes
  const fetchParishes = useCallback(async (cityId: string) => {
    if (!cityId) {
      setParishes([]);
      return;
    }
    const { data } = await supabase
      .from("parishes")
      .select("id, name")
      .eq("city_id", cityId)
      .order("name");
    setParishes(data || []);
  }, []);

  // Handle state change
  const handleStateChange = useCallback((stateId: string) => {
    form.setValue("state_id", stateId);
    form.setValue("municipality_id", "");
    form.setValue("city_id", "");
    form.setValue("parish_id", "");
    setCities([]);
    setParishes([]);
    fetchMunicipalities(stateId);
  }, [form, fetchMunicipalities]);

  // Handle municipality change
  const handleMunicipalityChange = useCallback((municipalityId: string) => {
    form.setValue("municipality_id", municipalityId);
    form.setValue("city_id", "");
    form.setValue("parish_id", "");
    setParishes([]);
    fetchCities(municipalityId);
  }, [form, fetchCities]);

  // Handle city change
  const handleCityChange = useCallback((cityId: string) => {
    form.setValue("city_id", cityId);
    form.setValue("parish_id", "");
    fetchParishes(cityId);
  }, [form, fetchParishes]);

  // Handle parish change
  const handleParishChange = useCallback((parishId: string) => {
    form.setValue("parish_id", parishId);
  }, [form]);

  // Fetch school data if editing
  useEffect(() => {
    if (isEditing && id) {
      const fetchSchool = async () => {
        const { data, error } = await supabase
          .from("schools")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error || !data) {
          toast.error("Colegio no encontrado");
          navigate("/admin/colegios");
          return;
        }

        form.reset({
          name: data.name,
          phone: data.phone,
          address: data.address,
          dea_code: data.dea_code,
          email: data.email,
          url: data.url || "",
          statistical_code: data.statistical_code,
          rif: data.rif,
          institution_type: data.institution_type as "public" | "private" | "subsidized" | "other",
          fax: data.fax || "",
          state_id: data.state_id || "",
          municipality_id: data.municipality_id || "",
          city_id: data.city_id || "",
          parish_id: data.parish_id || "",
        });

        setLogoUrl(data.logo_url);

        // Load cascading location data
        if (data.state_id) {
          await fetchMunicipalities(data.state_id);
        }
        if (data.municipality_id) {
          await fetchCities(data.municipality_id);
        }
        if (data.city_id) {
          await fetchParishes(data.city_id);
        }
      };
      fetchSchool();
    }
  }, [isEditing, id, form, navigate, fetchMunicipalities, fetchCities, fetchParishes]);

  // Handle image crop save
  const handleImageSave = (blob: Blob) => {
    setLogoBlob(blob);
    setLogoUrl(URL.createObjectURL(blob));
  };

  const onSubmit = async (data: SchoolFormValues) => {
    setLoading(true);
    try {
      let uploadedLogoUrl = logoUrl;

      // Upload logo if there's a new one
      if (logoBlob) {
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("school-logos")
          .upload(fileName, logoBlob, {
            contentType: "image/png",
            upsert: false,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from("school-logos")
          .getPublicUrl(uploadData.path);

        uploadedLogoUrl = publicUrlData.publicUrl;
      }

      const schoolData = {
        name: data.name,
        phone: data.phone,
        address: data.address,
        dea_code: data.dea_code,
        email: data.email,
        url: data.url || null,
        statistical_code: data.statistical_code,
        rif: data.rif,
        institution_type: data.institution_type,
        fax: data.fax || null,
        state_id: data.state_id || null,
        municipality_id: data.municipality_id || null,
        city_id: data.city_id || null,
        parish_id: data.parish_id || null,
        logo_url: uploadedLogoUrl,
        created_by: user?.id,
      };

      if (isEditing && id) {
        const { error } = await supabase
          .from("schools")
          .update(schoolData)
          .eq("id", id);

        if (error) throw error;
        toast.success("Colegio actualizado correctamente");
      } else {
        const { error } = await supabase.from("schools").insert([schoolData]);

        if (error) throw error;
        toast.success("Colegio creado correctamente");
      }

      navigate("/admin/colegios");
    } catch (error: any) {
      console.error("Error saving school:", error);
      toast.error("Error al guardar el colegio", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const stateId = form.watch("state_id");
  const municipalityId = form.watch("municipality_id");
  const cityId = form.watch("city_id");
  const parishId = form.watch("parish_id");

  return (
    <DashboardLayout>
      <PageHeader
        title={isEditing ? "Editar Colegio" : "Crear Colegio"}
        breadcrumbs={[
          { label: "Colegios", href: "/admin/colegios" },
          { label: isEditing ? "Editar Colegio" : "Crear Colegio" },
        ]}
      />

      <div className="bg-card rounded-lg shadow-sm border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Editar Colegio" : "Crear Colegio"}
          </h2>
          <Link to="/admin/colegios">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
        </div>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Logo upload area */}
            <div 
              className="bg-muted rounded-lg p-8 flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => setShowImageModal(true)}
            >
              {logoUrl ? (
                <Avatar className="h-24 w-24">
                  <AvatarImage src={logoUrl} alt="Logo" />
                  <AvatarFallback>Logo</AvatarFallback>
                </Avatar>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Haz click para agregar el logo
                  </p>
                </>
              )}
            </div>

            {/* Form fields grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la institución *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre de la institución" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono de la institución *</FormLabel>
                    <FormControl>
                      <Input placeholder="Teléfono de la institución" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección de la institución *</FormLabel>
                    <FormControl>
                      <Input placeholder="Dirección de la institución" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dea_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código DEA de la institución *</FormLabel>
                    <FormControl>
                      <Input placeholder="Código DEA de la institución" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo electrónico de la institución *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Correo electrónico" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL de la institución</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="statistical_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código Estadístico de la institución *</FormLabel>
                    <FormControl>
                      <Input placeholder="Código Estadístico" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="rif"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RIF de la institución *</FormLabel>
                    <FormControl>
                      <Input placeholder="J-12345678-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="institution_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de institución *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {institutionTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fax de la institución</FormLabel>
                    <FormControl>
                      <Input placeholder="Fax de la institución" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location selects */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="state_id"
                render={() => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={handleStateChange} value={stateId || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {states.map((state) => (
                          <SelectItem key={state.id} value={state.id}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="municipality_id"
                render={() => (
                  <FormItem>
                    <FormLabel>Municipio</FormLabel>
                    <Select
                      onValueChange={handleMunicipalityChange}
                      value={municipalityId || ""}
                      disabled={!stateId || municipalities.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={municipalities.length === 0 && stateId ? "Sin municipios" : "Municipio"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {municipalities.map((municipality) => (
                          <SelectItem key={municipality.id} value={municipality.id}>
                            {municipality.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="city_id"
                render={() => (
                  <FormItem>
                    <FormLabel>Ciudad</FormLabel>
                    <Select
                      onValueChange={handleCityChange}
                      value={cityId || ""}
                      disabled={!municipalityId || cities.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={cities.length === 0 && municipalityId ? "Sin ciudades" : "Ciudad"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cities.map((city) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parish_id"
                render={() => (
                  <FormItem>
                    <FormLabel>Parroquia</FormLabel>
                    <Select
                      onValueChange={handleParishChange}
                      value={parishId || ""}
                      disabled={!cityId || parishes.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={parishes.length === 0 && cityId ? "Sin parroquias" : "Parroquia"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {parishes.map((parish) => (
                          <SelectItem key={parish.id} value={parish.id}>
                            {parish.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit button */}
            <div className="flex justify-start">
              <Button type="submit" disabled={loading}>
                {loading ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Image crop modal */}
      <ImageCropModal
        open={showImageModal}
        onClose={() => setShowImageModal(false)}
        onSave={handleImageSave}
        currentImage={logoUrl}
      />
    </DashboardLayout>
  );
}
