import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Save, Plus, Trash2, Eye, Info, ChevronDown, Layers } from "lucide-react";

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

interface SignatureBlock {
  id?: string;
  name: string;
  signature_lines: string[];
  display_order: number;
  _newLine?: string;
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

interface Props {
  schoolId: string | null;
}

export default function GeneralConfigTab({ schoolId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>(defaultHeader);
  const [footerConfig, setFooterConfig] = useState<FooterConfig>(defaultFooter);
  const [signatureBlocks, setSignatureBlocks] = useState<SignatureBlock[]>([]);

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

  // Fetch existing general config (header/footer)
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

  // Fetch signature blocks
  const { data: existingBlocks = [] } = useQuery({
    queryKey: ["planilla-signature-blocks", schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data, error } = await supabase
        .from("planilla_signature_blocks" as any)
        .select("*")
        .eq("school_id", schoolId)
        .order("display_order");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!schoolId,
  });

  useEffect(() => {
    if (existingConfig) {
      setHeaderConfig({ ...defaultHeader, ...(existingConfig as any).header_config });
      setFooterConfig({ ...defaultFooter, ...(existingConfig as any).footer_config });
    }
  }, [existingConfig]);

  useEffect(() => {
    if (existingBlocks.length > 0) {
      setSignatureBlocks(
        existingBlocks.map((b: any) => ({
          id: b.id,
          name: b.name,
          signature_lines: Array.isArray(b.signature_lines) ? b.signature_lines : [],
          display_order: b.display_order,
          _newLine: "",
        }))
      );
    }
  }, [existingBlocks]);

  // Save header/footer
  const saveGeneralMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");
      const payload = {
        school_id: schoolId,
        header_config: headerConfig,
        footer_config: footerConfig,
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
      toast({ title: "Configuración guardada", description: "Encabezado y pie de página actualizados." });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo guardar." });
    },
  });

  // Save all signature blocks
  const saveBlocksMutation = useMutation({
    mutationFn: async () => {
      if (!schoolId) throw new Error("No school");

      const emptyName = signatureBlocks.some(b => !b.name.trim());
      if (emptyName) throw new Error("Todos los bloques deben tener un nombre.");

      // Delete all existing blocks for this school, then re-insert
      await supabase
        .from("planilla_signature_blocks" as any)
        .delete()
        .eq("school_id", schoolId);

      if (signatureBlocks.length === 0) return;

      const rows = signatureBlocks.map((b, idx) => ({
        school_id: schoolId,
        name: b.name.trim(),
        signature_lines: b.signature_lines,
        display_order: idx,
        ...(b.id ? { id: b.id } : {}),
      }));

      const { error } = await supabase
        .from("planilla_signature_blocks" as any)
        .insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planilla-signature-blocks"] });
      toast({ title: "Bloques guardados", description: "Bloques de firmas actualizados." });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Error", description: err.message || "No se pudo guardar." });
    },
  });

  const toggleHeader = (key: keyof HeaderConfig) => {
    setHeaderConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFooter = (key: keyof FooterConfig) => {
    setFooterConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Block management
  const addBlock = () => {
    setSignatureBlocks(prev => [
      ...prev,
      { name: "", signature_lines: [], display_order: prev.length, _newLine: "" },
    ]);
  };

  const removeBlock = (idx: number) => {
    setSignatureBlocks(prev => prev.filter((_, i) => i !== idx));
  };

  const updateBlockName = (idx: number, name: string) => {
    setSignatureBlocks(prev => prev.map((b, i) => i === idx ? { ...b, name } : b));
  };

  const addLineToBlock = (blockIdx: number) => {
    setSignatureBlocks(prev => prev.map((b, i) => {
      if (i !== blockIdx) return b;
      const val = (b._newLine || "").trim();
      if (!val) return b;
      return { ...b, signature_lines: [...b.signature_lines, val], _newLine: "" };
    }));
  };

  const updateBlockNewLine = (blockIdx: number, value: string) => {
    setSignatureBlocks(prev => prev.map((b, i) => i === blockIdx ? { ...b, _newLine: value } : b));
  };

  const updateLine = (blockIdx: number, lineIdx: number, value: string) => {
    setSignatureBlocks(prev => prev.map((b, i) => {
      if (i !== blockIdx) return b;
      return { ...b, signature_lines: b.signature_lines.map((l, li) => li === lineIdx ? value : l) };
    }));
  };

  const removeLine = (blockIdx: number, lineIdx: number) => {
    setSignatureBlocks(prev => prev.map((b, i) => {
      if (i !== blockIdx) return b;
      return { ...b, signature_lines: b.signature_lines.filter((_, li) => li !== lineIdx) };
    }));
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
      {/* HEADER / FOOTER */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Modificaciones Generales de Planillas</CardTitle>
          <Button onClick={() => saveGeneralMutation.mutate()} disabled={saveGeneralMutation.isPending} className="gap-2">
            <Save className="h-4 w-4" />
            {saveGeneralMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Configura los elementos que aparecerán en el encabezado y pie de página de las planillas. Los datos se toman automáticamente de la información del colegio.
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
        </CardContent>
      </Card>

      {/* SIGNATURE BLOCKS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Bloques de Firmas</CardTitle>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addBlock} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo bloque
            </Button>
            <Button onClick={() => saveBlocksMutation.mutate()} disabled={saveBlocksMutation.isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {saveBlocksMutation.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Crea bloques de firmas reutilizables. Luego, en la pestaña "Planilla de Inscripción", puedes asignar un bloque a cada sección donde quieras que aparezcan las firmas.
            </p>
          </div>

          {signatureBlocks.length === 0 && (
            <div className="text-center py-10 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground mb-3">No hay bloques de firmas creados aún.</p>
              <Button variant="outline" onClick={addBlock} className="gap-2">
                <Plus className="h-4 w-4" />
                Crear primer bloque
              </Button>
            </div>
          )}

          {signatureBlocks.map((block, blockIdx) => (
            <Collapsible key={blockIdx} defaultOpen={!block.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center gap-3 p-4 bg-muted/30">
                <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input
                  value={block.name}
                  onChange={(e) => updateBlockName(blockIdx, e.target.value)}
                  placeholder="Nombre del bloque (ej: Firmas de Inscripción)"
                  className="flex-1 font-medium"
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap px-2 py-1 bg-muted rounded">
                  {block.signature_lines.length} {block.signature_lines.length === 1 ? "firma" : "firmas"}
                </span>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="flex-shrink-0">
                    <ChevronDown className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                  </Button>
                </CollapsibleTrigger>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeBlock(blockIdx)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <CollapsibleContent>
                <div className="p-4 border-t space-y-3">
                  <div className="space-y-2">
                    {block.signature_lines.map((line, lineIdx) => (
                      <div key={lineIdx} className="flex items-center gap-2">
                        <Input
                          value={line}
                          onChange={(e) => updateLine(blockIdx, lineIdx, e.target.value)}
                          className="flex-1"
                          placeholder="Ej: Firma del Representante"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(blockIdx, lineIdx)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={block._newLine || ""}
                      onChange={(e) => updateBlockNewLine(blockIdx, e.target.value)}
                      placeholder="Nueva línea de firma (ej: Firma del Secretario)"
                      className="flex-1"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLineToBlock(blockIdx); } }}
                    />
                    <Button variant="outline" size="sm" onClick={() => addLineToBlock(blockIdx)} className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      Agregar
                    </Button>
                  </div>

                  {/* Mini preview */}
                  {block.signature_lines.length > 0 && (
                    <div className="mt-3 p-3 rounded-md bg-white border">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-2">Vista previa</p>
                      <div className={`grid gap-4 ${block.signature_lines.length <= 3 ? `grid-cols-${block.signature_lines.length}` : "grid-cols-3"}`}>
                        {block.signature_lines.map((sig, idx) => (
                          <div key={idx} className="text-center">
                            <div className="border-b border-foreground/30 mb-1 h-6" />
                            <p className="text-[9px] text-muted-foreground">{sig}</p>
                            <p className="text-[8px] text-muted-foreground mt-0.5">C.I.</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>

      {/* PREVIEW */}
      {school && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Previsualización de Encabezado/Pie</CardTitle>
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
