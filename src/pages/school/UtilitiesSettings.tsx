import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Save, Upload, RotateCcw, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { toast } from "sonner";
import { CarnetLayoutConfig, DEFAULT_LAYOUT } from "@/components/utilities/CarnetEditor";
import { CarnetControls } from "@/components/utilities/CarnetControls";
import { CarnetPreview } from "@/components/utilities/CarnetPreview";

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
  const [layout, setLayout] = useState<CarnetLayoutConfig>(DEFAULT_LAYOUT);

  // Fetch school full details (location)
  const { data: schoolFull } = useQuery({
    queryKey: ["school-full-details", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("schools")
        .select("*, cities(name), states(name)")
        .eq("id", schoolId!)
        .single();
      return data;
    },
    enabled: !!schoolId,
  });

  // Fetch active school year
  const { data: activeYear } = useQuery({
    queryKey: ["active-school-year", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("school_years")
        .select("year_range")
        .eq("school_id", schoolId!)
        .eq("is_active", true)
        .maybeSingle();
      return data?.year_range || "";
    },
    enabled: !!schoolId,
  });

  const schoolLocation = [
    (schoolFull?.cities as any)?.name,
    (schoolFull?.states as any)?.name,
  ].filter(Boolean).join(", ") || "";
  const schoolYear = activeYear || "";

  const { data: config } = useQuery({
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
    const lc = config.layout_config as any;
    if (lc && typeof lc === "object" && lc.headerHeight) {
      setLayout({
        ...DEFAULT_LAYOUT,
        headerHeight: lc.headerHeight ?? DEFAULT_LAYOUT.headerHeight,
        photoSize: lc.photoSize ?? DEFAULT_LAYOUT.photoSize,
        photoPos: lc.photoPos ?? DEFAULT_LAYOUT.photoPos,
        namePos: lc.namePos ?? DEFAULT_LAYOUT.namePos,
        badgePos: lc.badgePos ?? DEFAULT_LAYOUT.badgePos,
        docPos: lc.docPos ?? DEFAULT_LAYOUT.docPos,
        qrPos: lc.qrPos ?? DEFAULT_LAYOUT.qrPos,
        schoolNamePos: lc.schoolNamePos ?? DEFAULT_LAYOUT.schoolNamePos,
        cityPos: lc.cityPos ?? DEFAULT_LAYOUT.cityPos,
        yearPos: lc.yearPos ?? DEFAULT_LAYOUT.yearPos,
        logoPos: lc.logoPos ?? DEFAULT_LAYOUT.logoPos,
        logoSize: lc.logoSize ?? DEFAULT_LAYOUT.logoSize,
        qrSize: lc.qrSize ?? DEFAULT_LAYOUT.qrSize,
        fontSizes: {
          schoolName: lc.fontSizes?.schoolName ?? DEFAULT_LAYOUT.fontSizes.schoolName,
          studentName: lc.fontSizes?.studentName ?? DEFAULT_LAYOUT.fontSizes.studentName,
          document: lc.fontSizes?.document ?? DEFAULT_LAYOUT.fontSizes.document,
        },
      });
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let watermarkUrl = config?.watermark_url || null;

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
        watermarkUrl = null;
      }

      const payload = {
        school_id: schoolId!,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        watermark_url: watermarkUrl,
        watermark_opacity: watermarkOpacity,
        watermark_size: watermarkSize,
        layout_config: layout as any,
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
    setLayout(DEFAULT_LAYOUT);
  };

  const previewLogoUrl = school?.logo_url || null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Utilidades"
        breadcrumbs={[{ label: "Ajustes" }, { label: "Utilidades" }]}
      />

      <div className="flex items-center gap-3 mb-6">
        <CreditCard className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Configuración de Carnet</h2>
      </div>

      {/* Main 2-column layout: controls left, preview right sticky */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* LEFT: All controls */}
        <div className="space-y-6">
          {/* Colors */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Colores que identifican al Colegio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Color Principal</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                    <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-28 text-xs font-mono" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Color Secundario</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0 p-0" />
                    <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-28 text-xs font-mono" />
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
              <p className="text-xs text-muted-foreground">Por defecto se usa el logo del colegio. Puedes subir una imagen personalizada.</p>
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
                <Slider value={[watermarkOpacity * 100]} onValueChange={(v) => setWatermarkOpacity(v[0] / 100)} min={2} max={20} step={1} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs">Tamaño (mm): {watermarkSize}</Label>
                <Slider value={[watermarkSize]} onValueChange={(v) => setWatermarkSize(v[0])} min={15} max={45} step={1} className="mt-2" />
              </div>
            </CardContent>
          </Card>

          {/* Layout controls */}
          <CarnetControls layout={layout} onLayoutChange={setLayout} />

          {/* Actions */}
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

        {/* RIGHT: Sticky Preview */}
        <div className="sticky top-4">
          <CarnetPreview
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            schoolName={school?.name || ""}
            logoUrl={previewLogoUrl}
            watermarkUrl={useCustomWatermark && watermarkPreview ? watermarkPreview : null}
            watermarkOpacity={watermarkOpacity}
            watermarkSize={watermarkSize}
            useCustomWatermark={useCustomWatermark}
            layout={layout}
            onLayoutChange={setLayout}
            schoolLocation={schoolLocation}
            schoolYear={schoolYear}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
