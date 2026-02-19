import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Plus, Trash2, Eye, Info } from "lucide-react";

interface HeaderConfig {
  show_logo: boolean;
  show_name: boolean;
  show_dea_code: boolean;
  show_statistical_code: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_rif: boolean;
  show_student_photo: boolean;
  show_representative_photo: boolean;
}

interface FooterConfig {
  show_address: boolean;
  show_phone: boolean;
  show_rif: boolean;
}

interface SchoolFull {
  id: string;
  name: string;
  logo_url: string | null;
  dea_code: string;
  statistical_code: string;
  address: string;
  phone: string;
  rif: string;
  fax: string | null;
  email: string;
  state_id: string | null;
  municipality_id: string | null;
  city_id: string | null;
  parish_id: string | null;
}

const defaultHeader: HeaderConfig = {
  show_logo: true,
  show_name: true,
  show_dea_code: true,
  show_statistical_code: true,
  show_address: true,
  show_phone: true,
  show_rif: true,
  show_student_photo: true,
  show_representative_photo: true,
};

const defaultFooter: FooterConfig = {
  show_address: true,
  show_phone: true,
  show_rif: true,
};

const defaultSignatures = ["Firma del Representante", "Firma del Director(a)", "Firma del Coordinador(a)"];

interface Props {
  schoolId: string | null;
}

export default function GeneralConfigTab({ schoolId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>(defaultHeader);
  const [footerConfig, setFooterConfig] = useState<FooterConfig>(defaultFooter);
  const [signatureLines, setSignatureLines] = useState<string[]>(defaultSignatures);
  const [newSignature, setNewSignature] = useState("");

  // Fetch full school data
  const { data: school } = useQuery({
    queryKey: ["school-full-data", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data, error } = await supabase
        .from("schools")
        .select("id, name, logo_url, dea_code, statistical_code, address, phone, rif, fax, email, state_id, municipality_id, city_id, parish_id")
        .eq("id", schoolId)
        .single();
      if (error) throw error;
      return data as SchoolFull;
    },
    enabled: !!schoolId,
  });

  // Fetch location names
  const { data: locationNames } = useQuery({
    queryKey: ["school-location-names", school?.state_id, school?.municipality_id, school?.city_id, school?.parish_id],
    queryFn: async () => {
      if (!school) return { state: "", municipality: "", city: "", parish: "" };
      const result: Record<string, string> = { state: "", municipality: "", city: "", parish: "" };

      if (school.state_id) {
        const { data } = await supabase.from("states").select("name").eq("id", school.state_id).single();
        if (data) result.state = data.name;
      }
      if (school.municipality_id) {
        const { data } = await supabase.from("municipalities").select("name").eq("id", school.municipality_id).single();
        if (data) result.municipality = data.name;
      }
      if (school.city_id) {
        const { data } = await supabase.from("cities").select("name").eq("id", school.city_id).single();
        if (data) result.city = data.name;
      }
      if (school.parish_id) {
        const { data } = await supabase.from("parishes").select("name").eq("id", school.parish_id).single();
        if (data) result.parish = data.name;
      }
      return result;
    },
    enabled: !!school,
  });

  // Fetch existing config
  const { data: existingConfig } = useQuery({
    queryKey: ["planilla-general-config", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data, error } = await supabase
        .from("planilla_general_config" as any)
        .select("*")
        .eq("school_id", schoolId)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  useEffect(() => {
    if (existingConfig) {
      setHeaderConfig({ ...defaultHeader, ...(existingConfig as any).header_config });
      setFooterConfig({ ...defaultFooter, ...(existingConfig as any).footer_config });
      const sigs = (existingConfig as any).signature_lines;
      if (Array.isArray(sigs)) setSignatureLines(sigs);
    }
  }, [existingConfig]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");

      const payload = {
        school_id: schoolId,
        header_config: headerConfig,
        footer_config: footerConfig,
        signature_lines: signatureLines,
      };

      if (existingConfig) {
        const { error } = await supabase
          .from("planilla_general_config" as any)
          .update(payload as any)
          .eq("school_id", schoolId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("planilla_general_config" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planilla-general-config"] });
      toast({ title: "Configuración guardada", description: "Modificaciones generales actualizadas." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar." });
    },
  });

  const toggleHeader = (key: keyof HeaderConfig) => {
    setHeaderConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFooter = (key: keyof FooterConfig) => {
    setFooterConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const addSignature = () => {
    const val = newSignature.trim();
    if (!val) return;
    setSignatureLines(prev => [...prev, val]);
    setNewSignature("");
  };

  const removeSignature = (index: number) => {
    setSignatureLines(prev => prev.filter((_, i) => i !== index));
  };

  const updateSignature = (index: number, value: string) => {
    setSignatureLines(prev => prev.map((s, i) => i === index ? value : s));
  };

  // Build address string for preview
  const buildAddressLine = () => {
    if (!school || !locationNames) return "";
    const parts: string[] = [];
    if (school.address) parts.push(school.address);
    if (locationNames.parish) parts.push(`Parroquia ${locationNames.parish}`);
    if (locationNames.municipality) parts.push(`Municipio ${locationNames.municipality}`);
    if (locationNames.city && locationNames.state) {
      parts.push(`${locationNames.city}, ${locationNames.state}`);
    } else if (locationNames.state) {
      parts.push(locationNames.state);
    }
    return parts.join(", ");
  };

  const headerToggles: { key: keyof HeaderConfig; label: string }[] = [
    { key: "show_logo", label: "Logo del Colegio" },
    { key: "show_name", label: "Nombre del Colegio" },
    { key: "show_dea_code", label: "Código DEA" },
    { key: "show_statistical_code", label: "Código Estadístico" },
    { key: "show_address", label: "Dirección completa" },
    { key: "show_phone", label: "Teléfono" },
    { key: "show_rif", label: "RIF" },
    { key: "show_student_photo", label: "Espacio para foto del estudiante" },
    { key: "show_representative_photo", label: "Espacio para foto del representante" },
  ];

  const footerToggles: { key: keyof FooterConfig; label: string }[] = [
    { key: "show_address", label: "Dirección" },
    { key: "show_phone", label: "Teléfono" },
    { key: "show_rif", label: "RIF" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Modificaciones Generales de Planillas</CardTitle>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Configura los elementos que aparecerán en el encabezado, pie de página y firmas de las planillas de inscripción. Los datos se toman automáticamente de la información del colegio.
            </p>
          </div>

          {/* HEADER CONFIG */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Encabezado</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {headerToggles.map(t => (
                <label key={t.key} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                  <span className="text-sm">{t.label}</span>
                  <Switch checked={headerConfig[t.key]} onCheckedChange={() => toggleHeader(t.key)} />
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* FOOTER CONFIG */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pie de Página</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {footerToggles.map(t => (
                <label key={t.key} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                  <span className="text-sm">{t.label}</span>
                  <Switch checked={footerConfig[t.key]} onCheckedChange={() => toggleFooter(t.key)} />
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* SIGNATURES CONFIG */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Firmas</h3>
            <div className="space-y-2 mb-3">
              {signatureLines.map((sig, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={sig}
                    onChange={(e) => updateSignature(idx, e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSignature(idx)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSignature}
                onChange={(e) => setNewSignature(e.target.value)}
                placeholder="Nueva línea de firma (ej: Firma del Secretario)"
                className="flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSignature(); } }}
              />
              <Button variant="outline" size="sm" onClick={addSignature} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PREVIEW */}
      {school && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Previsualización</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden bg-white text-foreground">
              {/* HEADER PREVIEW */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Logo */}
                  {headerConfig.show_logo && (
                    <div className="flex-shrink-0 w-16 h-16 border rounded-full overflow-hidden bg-muted flex items-center justify-center">
                      {school.logo_url ? (
                        <img src={school.logo_url} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[8px] text-muted-foreground">Logo</span>
                      )}
                    </div>
                  )}

                  {/* Center info */}
                  <div className="flex-1 text-center space-y-0.5">
                    {headerConfig.show_name && (
                      <p className="text-sm font-bold">{school.name}</p>
                    )}
                    {(headerConfig.show_dea_code || headerConfig.show_statistical_code) && (
                      <p className="text-[10px] text-muted-foreground">
                        {headerConfig.show_dea_code && `Código DEA: ${school.dea_code}`}
                        {headerConfig.show_dea_code && headerConfig.show_statistical_code && " - "}
                        {headerConfig.show_statistical_code && `Código Estadístico: ${school.statistical_code}`}
                      </p>
                    )}
                    {headerConfig.show_address && (
                      <p className="text-[10px] text-muted-foreground">{buildAddressLine()}</p>
                    )}
                    {(headerConfig.show_phone || headerConfig.show_rif) && (
                      <p className="text-[10px] text-muted-foreground">
                        {headerConfig.show_phone && `Tel: ${school.phone}`}
                        {headerConfig.show_phone && headerConfig.show_rif && "  -  "}
                        {headerConfig.show_rif && `Rif: ${school.rif}`}
                      </p>
                    )}
                  </div>

                  {/* Photo spaces */}
                  <div className="flex gap-2 flex-shrink-0">
                    {headerConfig.show_representative_photo && (
                      <div className="w-14 h-16 border rounded bg-muted/50 flex items-center justify-center">
                        <span className="text-[7px] text-muted-foreground text-center leading-tight">Foto<br/>Rep.</span>
                      </div>
                    )}
                    {headerConfig.show_student_photo && (
                      <div className="w-14 h-16 border rounded bg-muted/50 flex items-center justify-center">
                        <span className="text-[7px] text-muted-foreground text-center leading-tight">Foto<br/>Est.</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-center mt-2">
                  <p className="text-sm font-bold uppercase tracking-wide">Planilla</p>
                </div>
              </div>

              <Separator />

              {/* Content placeholder */}
              <div className="p-4 py-8 text-center">
                <p className="text-xs text-muted-foreground/50 italic">— Contenido de las secciones —</p>
              </div>

              <Separator />

              {/* SIGNATURES PREVIEW */}
              {signatureLines.length > 0 && (
                <div className="p-4">
                  <div className={`grid gap-6 ${signatureLines.length <= 3 ? `grid-cols-${signatureLines.length}` : 'grid-cols-3'}`}>
                    {signatureLines.map((sig, idx) => (
                      <div key={idx} className="text-center">
                        <div className="border-b border-foreground/30 mb-1 h-8" />
                        <p className="text-[9px] text-muted-foreground">{sig}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* FOOTER PREVIEW */}
              <div className="p-3 text-center space-y-0.5">
                {footerConfig.show_address && (
                  <p className="text-[9px] text-muted-foreground">{buildAddressLine()}</p>
                )}
                {(footerConfig.show_phone || footerConfig.show_rif) && (
                  <p className="text-[9px] text-muted-foreground">
                    {footerConfig.show_phone && `Tel: ${school.phone}`}
                    {footerConfig.show_phone && footerConfig.show_rif && "  "}
                    {footerConfig.show_rif && `Rif: ${school.rif}`}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
