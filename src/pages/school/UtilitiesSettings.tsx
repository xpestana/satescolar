import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Save, Upload, RotateCcw, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { toast } from "sonner";

const DEFAULT_PRIMARY = "#01051e";
const DEFAULT_SECONDARY = "#1e78c8";

export default function UtilitiesSettings() {
  const { schoolId } = useSchoolId();
  const { school } = useSchoolData();
  const queryClient = useQueryClient();

  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [secondaryColor, setSecondaryColor] = useState(DEFAULT_SECONDARY);
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.06);
  const [watermarkSize, setWatermarkSize] = useState(30);
  const [watermarkFile, setWatermarkFile] = useState<File | null>(null);
  const [watermarkPreview, setWatermarkPreview] = useState<string | null>(null);
  const [useCustomWatermark, setUseCustomWatermark] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["carnet-config", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carnet_config")
        .select("*")
        .eq("school_id", schoolId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!schoolId,
  });

  // Sync state when config loads
  useState(() => {
    if (config) {
      setPrimaryColor(config.primary_color || DEFAULT_PRIMARY);
      setSecondaryColor(config.secondary_color || DEFAULT_SECONDARY);
      setWatermarkOpacity(Number(config.watermark_opacity) || 0.06);
      setWatermarkSize(Number(config.watermark_size) || 30);
      if (config.watermark_url) {
        setWatermarkPreview(config.watermark_url);
        setUseCustomWatermark(true);
      }
    }
  });

  // Re-sync when config changes
  const [prevConfigId, setPrevConfigId] = useState<string | null>(null);
  if (config && config.id !== prevConfigId) {
    setPrevConfigId(config.id);
    setPrimaryColor(config.primary_color || DEFAULT_PRIMARY);
    setSecondaryColor(config.secondary_color || DEFAULT_SECONDARY);
    setWatermarkOpacity(Number(config.watermark_opacity) || 0.06);
    setWatermarkSize(Number(config.watermark_size) || 30);
    if (config.watermark_url) {
      setWatermarkPreview(config.watermark_url);
      setUseCustomWatermark(true);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let watermarkUrl = config?.watermark_url || null;

      // Upload custom watermark if provided
      if (watermarkFile && schoolId) {
        const ext = watermarkFile.name.split(".").pop();
        const path = `${schoolId}/carnet-watermark.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("school-assets")
          .upload(path, watermarkFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("school-assets").getPublicUrl(path);
        watermarkUrl = urlData.publicUrl;
      } else if (!useCustomWatermark) {
        watermarkUrl = null; // Will use school logo as default
      }

      const payload = {
        school_id: schoolId!,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        watermark_url: watermarkUrl,
        watermark_opacity: watermarkOpacity,
        watermark_size: watermarkSize,
      };

      if (config) {
        const { error } = await supabase.from("carnet_config").update(payload).eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("carnet_config").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carnet-config"] });
      toast.success("Configuración de carnet guardada");
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setWatermarkFile(file);
      setUseCustomWatermark(true);
      const reader = new FileReader();
      reader.onload = () => setWatermarkPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetDefaults = () => {
    setPrimaryColor(DEFAULT_PRIMARY);
    setSecondaryColor(DEFAULT_SECONDARY);
    setWatermarkOpacity(0.06);
    setWatermarkSize(30);
    setWatermarkFile(null);
    setWatermarkPreview(null);
    setUseCustomWatermark(false);
  };

  // Preview card colors
  const previewLogoUrl = school?.logo_url || null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Utilidades"
        breadcrumbs={[
          { label: "Ajustes" },
          { label: "Utilidades" },
        ]}
      />

      <div className="space-y-6">
        <Accordion type="single" collapsible defaultValue="carnet">
          <AccordionItem value="carnet" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-6 py-4 hover:no-underline">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">Configuración de Carnet</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Settings */}
                <div className="space-y-6">
                  {/* Colors */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Colores del Carnet</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <Label className="text-xs text-muted-foreground">Color Principal</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                            />
                            <Input
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              className="w-28 text-xs font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Color Secundario</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="color"
                              value={secondaryColor}
                              onChange={(e) => setSecondaryColor(e.target.value)}
                              className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                            />
                            <Input
                              value={secondaryColor}
                              onChange={(e) => setSecondaryColor(e.target.value)}
                              className="w-28 text-xs font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Watermark */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Marca de Agua</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Por defecto se usa el logo del colegio. Puedes subir una imagen personalizada.
                      </p>
                      <div>
                        <Label className="text-xs">Imagen personalizada (opcional)</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button variant="outline" size="sm" onClick={() => document.getElementById("watermark-input")?.click()}>
                            <Upload className="h-3 w-3 mr-1" /> Subir imagen
                          </Button>
                          {useCustomWatermark && (
                            <Button variant="ghost" size="sm" onClick={() => { setUseCustomWatermark(false); setWatermarkFile(null); setWatermarkPreview(null); }}>
                              Usar logo por defecto
                            </Button>
                          )}
                        </div>
                        <input id="watermark-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      </div>

                      {watermarkPreview && useCustomWatermark && (
                        <div className="w-20 h-20 border rounded p-1">
                          <img src={watermarkPreview} alt="Watermark" className="w-full h-full object-contain" />
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">Opacidad: {Math.round(watermarkOpacity * 100)}%</Label>
                        <Slider
                          value={[watermarkOpacity * 100]}
                          onValueChange={(v) => setWatermarkOpacity(v[0] / 100)}
                          min={2}
                          max={20}
                          step={1}
                          className="mt-2"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">Tamaño (mm): {watermarkSize}</Label>
                        <Slider
                          value={[watermarkSize]}
                          onValueChange={(v) => setWatermarkSize(v[0])}
                          min={15}
                          max={45}
                          step={1}
                          className="mt-2"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex gap-2">
                    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {saveMutation.isPending ? "Guardando..." : "Guardar"}
                    </Button>
                    <Button variant="outline" onClick={resetDefaults}>
                      <RotateCcw className="h-4 w-4 mr-2" /> Restablecer
                    </Button>
                  </div>
                </div>

                {/* Live Preview */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Vista Previa</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="mx-auto border rounded-lg overflow-hidden shadow-lg"
                      style={{ width: 216, height: 342 }}
                    >
                      {/* Header */}
                      <div className="relative" style={{ height: 88, backgroundColor: primaryColor }}>
                        {/* Left triangle */}
                        <svg className="absolute top-0 left-0" width="40" height="68" viewBox="0 0 40 68">
                          <polygon points="0,0 40,0 0,68" fill={secondaryColor} />
                        </svg>
                        {/* Right triangle */}
                        <svg className="absolute top-0 right-0" width="40" height="68" viewBox="0 0 40 68">
                          <polygon points="40,0 0,0 40,68" fill={secondaryColor} style={{ opacity: 0.7 }} />
                        </svg>
                        {/* Stripe */}
                        <div className="absolute bottom-0 left-0 right-0 h-1" style={{ backgroundColor: secondaryColor }} />
                        {/* Logo */}
                        {previewLogoUrl && (
                          <img src={previewLogoUrl} alt="" className="absolute left-1/2 -translate-x-1/2 top-2 h-8 w-8 object-contain" />
                        )}
                        <div className="absolute bottom-3 left-0 right-0 text-center">
                          <p className="text-white text-[8px] font-bold px-4 leading-tight">{school?.name?.toUpperCase() || "NOMBRE DEL COLEGIO"}</p>
                          <p className="text-white/80 text-[6px] mt-0.5">Ciudad, Estado</p>
                          <p className="text-white/70 text-[6px]">Año Escolar: 2024-2025</p>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="relative bg-white flex-1" style={{ height: 254 - 16 }}>
                        {/* Watermark */}
                        {(watermarkPreview || previewLogoUrl) && (
                          <img
                            src={useCustomWatermark && watermarkPreview ? watermarkPreview : previewLogoUrl || ""}
                            alt=""
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 object-contain pointer-events-none"
                            style={{
                              width: `${(watermarkSize / 54) * 100}%`,
                              height: `${(watermarkSize / 54) * 100}%`,
                              opacity: watermarkOpacity,
                            }}
                          />
                        )}

                        {/* Photo placeholder */}
                        <div className="flex justify-center pt-3">
                          <div
                            className="rounded-full border-2 bg-muted flex items-center justify-center"
                            style={{ width: 56, height: 56, borderColor: secondaryColor }}
                          >
                            <span className="text-muted-foreground text-[10px]">Foto</span>
                          </div>
                        </div>

                        <div className="text-center mt-2 px-2">
                          <p className="font-bold text-[9px]" style={{ color: primaryColor }}>NOMBRE DEL ESTUDIANTE</p>
                          <div
                            className="mx-auto mt-1 rounded-full px-3 py-0.5"
                            style={{ backgroundColor: secondaryColor, width: "fit-content" }}
                          >
                            <span className="text-white text-[7px] font-bold">ESTUDIANTE</span>
                          </div>
                          <p className="mt-1.5 font-bold text-[8px]" style={{ color: primaryColor }}>V-12345678</p>

                          {/* QR placeholder */}
                          <div className="mt-1.5 mx-auto bg-muted border rounded flex items-center justify-center" style={{ width: 44, height: 44 }}>
                            <span className="text-muted-foreground text-[7px]">QR</span>
                          </div>
                        </div>

                        {/* Bottom bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-4 flex">
                          <div className="flex-1" style={{ backgroundColor: primaryColor }} />
                          <svg width="32" height="16" viewBox="0 0 32 16" className="absolute right-0 bottom-0">
                            <polygon points="32,16 0,16 32,0" fill={secondaryColor} />
                          </svg>
                          <svg width="24" height="16" viewBox="0 0 24 16" className="absolute left-0 bottom-0">
                            <polygon points="0,16 24,16 0,0" fill={secondaryColor} style={{ opacity: 0.7 }} />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </DashboardLayout>
  );
}
