import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Edit, Trash2, Loader2, CheckCircle2, ChevronDown, ChevronRight, UserCircle2, Upload,
} from "lucide-react";
import {
  BachilleratoConfig, BachilleratoTemplate, BoletinSignature,
  DEFAULT_BACHILLERATO_CONFIG, SAMPLE_RENDER_DATA, generateBoletaHtml,
  SAMPLE_BOLETIN_COMPLETO_DATA, generateBoletinCompletoHtml, cfgForBoletinPreview,
  SAMPLE_PRIMARY_DESCRIPTIVE_DATA, generatePrimaryDescriptiveHtml,
} from "@/lib/bachilleratoTemplate";
import { Checkbox } from "@/components/ui/checkbox";
import { uploadToS3 } from "@/lib/s3-upload";

const GRADE_LABELS: Record<string, string> = {
  pre_maternal: "Pre-Maternal", maternal: "Maternal",
  i_nivel: "I Nivel", ii_nivel: "II Nivel", iii_nivel: "III Nivel",
  "1_grado": "1er Grado", "2_grado": "2do Grado", "3_grado": "3er Grado",
  "4_grado": "4to Grado", "5_grado": "5to Grado", "6_grado": "6to Grado",
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año", "6_ano": "6to Año",
};

const GRADE_GROUPS = [
  {
    label: "Preescolar",
    grades: ["pre_maternal", "maternal", "i_nivel", "ii_nivel", "iii_nivel"],
  },
  {
    label: "Primaria",
    grades: ["1_grado", "2_grado", "3_grado", "4_grado", "5_grado", "6_grado"],
  },
  {
    label: "Secundaria",
    grades: ["1_ano", "2_ano", "3_ano", "4_ano", "5_ano", "6_ano"],
  },
] as const;

// ─── tiny accordion ───────────────────────────────────────────────────────────
function Section({
  label, enabled, onToggle, children,
}: { label: string; enabled: boolean; onToggle: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}>
        <Switch checked={enabled} onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()} className="scale-75" />
        <span className="text-sm font-medium flex-1">{label}</span>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
               : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
      {open && <div className="p-3 space-y-3 border-t bg-background">{children}</div>}
    </div>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
        className="h-7 w-8 rounded border cursor-pointer p-0.5" />
      <Label className="text-xs flex-1">{label}</Label>
      <span className="text-xs text-muted-foreground font-mono">{value}</span>
    </div>
  );
}

function NumRow({ label, value, onChange, min = 6, max = 32, unit = "pt" }:
  { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string }) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs flex-1">{label}</Label>
      <Input type="number" value={value} min={min} max={max}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        className="h-7 w-20 text-xs text-right" />
      <span className="text-xs text-muted-foreground w-5">{unit}</span>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch checked={value} onCheckedChange={onChange} className="scale-75" />
      <Label className="text-xs">{label}</Label>
    </div>
  );
}

// ─── Signature editor ─────────────────────────────────────────────────────────
function SignatureEditor({ sigs, onChange, schoolId }: {
  sigs: BoletinSignature[];
  onChange: (sigs: BoletinSignature[]) => void;
  schoolId: string;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const empty = (): BoletinSignature => ({ nombre: "", cedula: "", cargo: "", firma_url: "", sello_url: "" });

  const upd = (i: number, patch: Partial<BoletinSignature>) => {
    const next = [...sigs];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  const handleImg = async (i: number, field: "firma_url" | "sello_url", file: File) => {
    const key = `${i}-${field}`;
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const result = await uploadToS3({ file, folder: "assets", schoolId, fileName: `boleta-sig-${Date.now()}-${file.name}` });
      upd(i, { [field]: result.publicUrl });
    } catch (e: any) {
      toast({ title: "Error subiendo imagen", description: e.message, variant: "destructive" });
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  return (
    <div className="space-y-3">
      {sigs.map((sig, i) => (
        <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Firma {i + 1}</span>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onChange(sigs.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Firma image */}
            <ImageUploadCell label="Imagen de firma" url={sig.firma_url} loading={!!uploading[`${i}-firma_url`]}
              onFile={(f) => handleImg(i, "firma_url", f)} onClear={() => upd(i, { firma_url: "" })} />
            {/* Sello image */}
            <ImageUploadCell label="Sello (opcional)" url={sig.sello_url} loading={!!uploading[`${i}-sello_url`]}
              onFile={(f) => handleImg(i, "sello_url", f)} onClear={() => upd(i, { sello_url: "" })} />
          </div>

          <div className="space-y-1.5">
            <InputRow label="Nombre" value={sig.nombre} placeholder="Prof. Juan Pérez" onChange={(v) => upd(i, { nombre: v })} />
            <InputRow label="Cédula" value={sig.cedula} placeholder="V-12.345.678" onChange={(v) => upd(i, { cedula: v })} />
            <InputRow label="Cargo" value={sig.cargo} placeholder="Director(a)" onChange={(v) => upd(i, { cargo: v })} />
          </div>
        </div>
      ))}

      {sigs.length < 3 && (
        <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => onChange([...sigs, empty()])}>
          <Plus className="h-3.5 w-3.5 mr-1" />Agregar firma {sigs.length > 0 ? `(${sigs.length}/3)` : ""}
        </Button>
      )}
      {sigs.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">Agrega hasta 3 firmantes</p>
      )}
    </div>
  );
}

function ImageUploadCell({ label, url, loading, onFile, onClear }: {
  label: string; url: string; loading: boolean;
  onFile: (f: File) => void; onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="border rounded flex items-center justify-center h-16 bg-background relative overflow-hidden cursor-pointer"
        onClick={() => ref.current?.click()}>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : url ? (
          <>
            <img src={url} alt="" className="max-h-full max-w-full object-contain p-1" />
            <button onClick={(e) => { e.stopPropagation(); onClear(); }}
              className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow text-destructive hover:bg-destructive hover:text-white">
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        ) : (
          <div className="text-center text-muted-foreground">
            <Upload className="h-4 w-4 mx-auto mb-0.5" />
            <span className="text-[10px]">Subir imagen</span>
          </div>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function InputRow({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder?: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs w-12 shrink-0">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="h-6 text-xs flex-1" />
    </div>
  );
}

function FooterLogoUpload({ url, onChange, schoolId }: {
  url: string; onChange: (url: string) => void; schoolId: string;
}) {
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs">URL o imagen del logo</Label>
      <div className="flex gap-1.5">
        <Input
          value={url}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... (pega URL o sube imagen)"
          className="h-7 text-xs flex-1"
        />
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 shrink-0" disabled={uploading}
          onClick={() => ref.current?.click()}>
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        </Button>
        <input ref={ref} type="file" accept="image/*" className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            try {
              const result = await uploadToS3({ file, folder: "assets", schoolId, fileName: `footer-logo-${Date.now()}-${file.name}` });
              onChange(result.publicUrl);
            } catch (err: any) {
              toast({ title: "Error subiendo imagen", description: err.message, variant: "destructive" });
            } finally {
              setUploading(false);
              e.target.value = "";
            }
          }}
        />
      </div>
      {url && <img src={url} alt="Logo pie" className="h-10 mt-1 object-contain" />}
    </div>
  );
}

// ─── Config panel ─────────────────────────────────────────────────────────────
function ConfigPanel({ cfg, onChange, schoolId }: {
  cfg: BachilleratoConfig;
  onChange: (updated: BachilleratoConfig) => void;
  schoolId: string;
}) {
  const upd = (patch: Partial<BachilleratoConfig>) => onChange({ ...cfg, ...patch });
  const sect = (k: keyof BachilleratoConfig["sections"]) =>
    upd({ sections: { ...cfg.sections, [k]: !cfg.sections[k] } });
  const updBoletin = (patch: Partial<NonNullable<BachilleratoConfig["boletin"]>>) =>
    onChange({ ...cfg, boletin: { ...cfg.boletin!, ...patch } });

  if (cfg.style === "boletin_completo") {
    return (
      <div className="space-y-2 pb-2">

        {/* Cabecera del colegio */}
        <Section label="Cabecera del colegio" enabled={cfg.sections.header} onToggle={() => sect("header")}>
          <ColorRow label="Color de línea divisora" value={cfg.header.accent_color}
            onChange={(v) => upd({ header: { ...cfg.header, accent_color: v } })} />
          <NumRow label="Tamaño nombre colegio" value={cfg.header.name_font_size}
            onChange={(v) => upd({ header: { ...cfg.header, name_font_size: v } })} />
          <NumRow label="Tamaño subtextos" value={cfg.header.sub_font_size}
            onChange={(v) => upd({ header: { ...cfg.header, sub_font_size: v } })} min={6} max={16} />
        </Section>

        {/* Tabla de calificaciones */}
        <Section label="Tabla de Calificaciones" enabled={cfg.sections.grades_table} onToggle={() => sect("grades_table")}>
          <ColorRow label="Fondo de cabecera" value={cfg.boletin?.table_header_bg ?? "#000000"}
            onChange={(v) => updBoletin({ table_header_bg: v })} />
          <ColorRow label="Color de letras cabecera" value={cfg.boletin?.table_header_text ?? "#ffffff"}
            onChange={(v) => updBoletin({ table_header_text: v })} />
          <ToggleRow label="Filas alternas" value={cfg.table.alt_row}
            onChange={(v) => upd({ table: { ...cfg.table, alt_row: v } })} />
          {cfg.table.alt_row && (
            <ColorRow label="Color fila alterna" value={cfg.table.alt_row_color}
              onChange={(v) => upd({ table: { ...cfg.table, alt_row_color: v } })} />
          )}
        </Section>

        {/* Diseño y espaciado */}
        <div className="border rounded-md p-3 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diseño y Espaciado</Label>
          <NumRow label="Margen superior" unit="mm" min={0} max={30}
            value={cfg.boletin?.margin_top ?? 4}
            onChange={(v) => updBoletin({ margin_top: v })} />
          <NumRow label="Margen inferior de página" unit="mm" min={0} max={60}
            value={cfg.boletin?.margin_bottom ?? 6}
            onChange={(v) => updBoletin({ margin_bottom: v })} />
          <NumRow label="Márgenes laterales" unit="mm" min={0} max={30}
            value={cfg.boletin?.margin_sides ?? 12}
            onChange={(v) => updBoletin({ margin_sides: v })} />
          <NumRow label="Tamaño título" unit="pt" min={8} max={20}
            value={cfg.boletin?.title_size ?? 14}
            onChange={(v) => updBoletin({ title_size: v })} />
        </div>

        {/* Mención */}
        <div className="border rounded-md p-3 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mención</Label>
          <input
            type="text"
            value={cfg.boletin?.mention ?? ""}
            onChange={(e) => updBoletin({ mention: e.target.value })}
            placeholder="Ej: CIENCIAS Y TECNOLOGÍA (dejar vacío si no aplica)"
            className="w-full h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Firmas */}
        <div className="border rounded-md overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
            <Switch
              checked={cfg.sections.signatures}
              onCheckedChange={() => sect("signatures")}
              className="scale-75"
            />
            <span className="text-sm font-medium flex-1">Firmas</span>
          </div>
          {cfg.sections.signatures && (
            <div className="p-3 space-y-3 border-t bg-background">
              <div className="border rounded-md p-3 space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Espaciado de firmas
                </Label>
                <NumRow label="Espacio sobre firmas" unit="mm" min={0} max={30}
                  value={cfg.boletin?.sig_gap_above ?? 4}
                  onChange={(v) => updBoletin({ sig_gap_above: v })} />
                <NumRow label="Espacio bajo firmas" unit="mm" min={0} max={20}
                  value={cfg.boletin?.sig_gap_below ?? 0}
                  onChange={(v) => updBoletin({ sig_gap_below: v })} />
                <NumRow label="Altura imagen firma" unit="px" min={20} max={60}
                  value={cfg.boletin?.sig_image_height ?? 40}
                  onChange={(v) => updBoletin({ sig_image_height: v })} />
                <NumRow label="Altura sello" unit="px" min={0} max={50}
                  value={cfg.boletin?.sig_sello_height ?? 28}
                  onChange={(v) => updBoletin({ sig_sello_height: v })} />
                <ToggleRow label="Anclar firmas al pie de la hoja" value={cfg.boletin?.sig_pin_bottom ?? false}
                  onChange={(v) => updBoletin({ sig_pin_bottom: v })} />
                <p className="text-xs text-muted-foreground">
                  Esta boleta se imprime en media hoja. Deja desactivado el anclaje y reduce espacio/altura si las firmas no caben.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Firmantes
                </Label>
                <p className="text-xs text-muted-foreground">
                  Sube imagen de firma y sello. Guarda la plantilla para aplicar en boletas de secundaria.
                </p>
                <SignatureEditor
                  sigs={cfg.boletin?.signatures ?? []}
                  onChange={(s) => updBoletin({ signatures: s })}
                  schoolId={schoolId}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Primaria Descriptivo style ──────────────────────────────────────────────
  if (cfg.style === "primaria_descriptivo") {
    const PRIMARIA_DEFAULTS: NonNullable<BachilleratoConfig["primaria"]> = {
      show_footer_logo: false, footer_logo_url: "", footer_logo_position: "center",
      margin_top: 12, margin_bottom: 12, margin_sides: 15,
      name_font_size: 14, sub_font_size: 10, body_font_size: 10,
      accent_color: "#1e3a5f", title_color: "#000000",
      show_address: false, show_dea_code: false, show_phone: false,
      show_slogan: true, slogan: "",
      signatures: [],
    };
    const updPrimaria = (patch: Partial<NonNullable<BachilleratoConfig["primaria"]>>) =>
      onChange({ ...cfg, primaria: { ...PRIMARIA_DEFAULTS, ...cfg.primaria, ...patch } });
    const pr = { ...PRIMARIA_DEFAULTS, ...cfg.primaria };
    return (
      <div className="space-y-2 pb-2">
        <Section label="Cabecera del colegio" enabled={cfg.sections.header} onToggle={() => sect("header")}>
          <ColorRow label="Color de acento" value={pr.accent_color}
            onChange={(v) => updPrimaria({ accent_color: v })} />
          <NumRow label="Tamaño nombre colegio" value={pr.name_font_size} min={8} max={24}
            onChange={(v) => updPrimaria({ name_font_size: v })} />
          <NumRow label="Tamaño subtextos" value={pr.sub_font_size} min={6} max={16}
            onChange={(v) => updPrimaria({ sub_font_size: v })} />
          <ToggleRow label="Mostrar dirección" value={pr.show_address}
            onChange={(v) => updPrimaria({ show_address: v })} />
          <ToggleRow label="Mostrar Código DEA" value={pr.show_dea_code}
            onChange={(v) => updPrimaria({ show_dea_code: v })} />
          <ToggleRow label="Mostrar teléfono" value={pr.show_phone}
            onChange={(v) => updPrimaria({ show_phone: v })} />
          <ToggleRow label="Mostrar slogan" value={pr.show_slogan ?? true}
            onChange={(v) => updPrimaria({ show_slogan: v })} />
          {(pr.show_slogan ?? true) && (
            <div className="space-y-1">
              <Label className="text-xs">Texto del slogan</Label>
              <Input
                value={pr.slogan ?? ""}
                onChange={(e) => updPrimaria({ slogan: e.target.value })}
                placeholder="Ej: Construyendo Vidas con Propósitos"
                className="h-7 text-xs"
              />
            </div>
          )}
        </Section>

        <div className="border rounded-md p-3 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Título</Label>
          <ColorRow label="Color del título" value={pr.title_color}
            onChange={(v) => updPrimaria({ title_color: v })} />
        </div>

        <div className="border rounded-md p-3 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diseño y Espaciado</Label>
          <NumRow label="Margen superior" unit="mm" min={0} max={30}
            value={pr.margin_top} onChange={(v) => updPrimaria({ margin_top: v })} />
          <NumRow label="Margen inferior" unit="mm" min={0} max={30}
            value={pr.margin_bottom} onChange={(v) => updPrimaria({ margin_bottom: v })} />
          <NumRow label="Márgenes laterales" unit="mm" min={0} max={30}
            value={pr.margin_sides} onChange={(v) => updPrimaria({ margin_sides: v })} />
          <NumRow label="Tamaño texto cuerpo" unit="pt" min={7} max={16}
            value={pr.body_font_size} onChange={(v) => updPrimaria({ body_font_size: v })} />
        </div>

        <div className="border rounded-md p-3 space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Logo al pie de página</Label>
          <ToggleRow label="Mostrar logo al pie" value={pr.show_footer_logo}
            onChange={(v) => updPrimaria({ show_footer_logo: v })} />
          {pr.show_footer_logo && (
            <>
              <FooterLogoUpload
                url={pr.footer_logo_url}
                onChange={(url) => updPrimaria({ footer_logo_url: url })}
                schoolId={schoolId}
              />
              <div className="space-y-1">
                <Label className="text-xs">Posición del logo</Label>
                <div className="flex gap-1.5">
                  {(["left", "center", "right"] as const).map((pos) => (
                    <Button key={pos} size="sm"
                      variant={pr.footer_logo_position === pos ? "default" : "outline"}
                      className="h-7 text-xs flex-1"
                      onClick={() => updPrimaria({ footer_logo_position: pos })}>
                      {pos === "left" ? "Izquierda" : pos === "center" ? "Centro" : "Derecha"}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <Section label="Firmas" enabled={cfg.sections.signatures} onToggle={() => sect("signatures")}>
          {cfg.sections.signatures && (
            <SignatureEditor
              sigs={pr.signatures ?? []}
              onChange={(s) => updPrimaria({ signatures: s })}
              schoolId={schoolId}
            />
          )}
        </Section>
      </div>
    );
  }

  // ── Simple style ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2 pb-2">

      {/* Encabezado */}
      <Section label="Encabezado" enabled={cfg.sections.header} onToggle={() => sect("header")}>
        <ColorRow label="Color de acento" value={cfg.header.accent_color}
          onChange={(v) => upd({ header: { ...cfg.header, accent_color: v } })} />
        <NumRow label="Tamaño nombre colegio" value={cfg.header.name_font_size}
          onChange={(v) => upd({ header: { ...cfg.header, name_font_size: v } })} />
        <NumRow label="Tamaño subtextos" value={cfg.header.sub_font_size}
          onChange={(v) => upd({ header: { ...cfg.header, sub_font_size: v } })} min={6} max={16} />
      </Section>

      {/* Título */}
      <Section label="Título / Encabezado de boleta" enabled={cfg.sections.title} onToggle={() => sect("title")}>
        <div className="space-y-1">
          <Label className="text-xs">Texto del título</Label>
          <Input value={cfg.title.text} onChange={(e) => upd({ title: { ...cfg.title, text: e.target.value } })}
            className="h-7 text-xs" />
        </div>
        <ColorRow label="Color de fondo" value={cfg.title.bg_color}
          onChange={(v) => upd({ title: { ...cfg.title, bg_color: v } })} />
        <ColorRow label="Color de texto" value={cfg.title.text_color}
          onChange={(v) => upd({ title: { ...cfg.title, text_color: v } })} />
        <NumRow label="Tamaño de fuente" value={cfg.title.font_size}
          onChange={(v) => upd({ title: { ...cfg.title, font_size: v } })} />
      </Section>

      {/* Datos del alumno */}
      <Section label="Datos del Alumno" enabled={cfg.sections.student_info} onToggle={() => sect("student_info")}>
        <ToggleRow label="Mostrar cédula / pasaporte" value={cfg.student.show_document}
          onChange={(v) => upd({ student: { ...cfg.student, show_document: v } })} />
        <ToggleRow label="Mostrar sección" value={cfg.student.show_section}
          onChange={(v) => upd({ student: { ...cfg.student, show_section: v } })} />
        <ColorRow label="Color de fondo" value={cfg.student.bg_color}
          onChange={(v) => upd({ student: { ...cfg.student, bg_color: v } })} />
        <ColorRow label="Color de borde" value={cfg.student.border_color}
          onChange={(v) => upd({ student: { ...cfg.student, border_color: v } })} />
      </Section>

      {/* Tabla de notas */}
      <Section label="Tabla de Notas" enabled={cfg.sections.grades_table} onToggle={() => sect("grades_table")}>
        <ColorRow label="Fondo de cabecera" value={cfg.table.header_bg}
          onChange={(v) => upd({ table: { ...cfg.table, header_bg: v } })} />
        <ColorRow label="Texto de cabecera" value={cfg.table.header_text}
          onChange={(v) => upd({ table: { ...cfg.table, header_text: v } })} />
        <ToggleRow label="Filas alternas" value={cfg.table.alt_row}
          onChange={(v) => upd({ table: { ...cfg.table, alt_row: v } })} />
        {cfg.table.alt_row && (
          <ColorRow label="Color fila alterna" value={cfg.table.alt_row_color}
            onChange={(v) => upd({ table: { ...cfg.table, alt_row_color: v } })} />
        )}
        <ToggleRow label="Colores aprobado / reprobado" value={cfg.table.pass_color}
          onChange={(v) => upd({ table: { ...cfg.table, pass_color: v } })} />
      </Section>

      {/* Resumen */}
      <Section label="Resumen (Definitiva y Posición)" enabled={cfg.sections.summary} onToggle={() => sect("summary")}>
        <ToggleRow label="Mostrar Definitiva del Momento" value={cfg.summary.show_definitiva}
          onChange={(v) => upd({ summary: { ...cfg.summary, show_definitiva: v } })} />
        {cfg.summary.show_definitiva && (<>
          <ColorRow label="Fondo definitiva" value={cfg.summary.definitiva_bg}
            onChange={(v) => upd({ summary: { ...cfg.summary, definitiva_bg: v } })} />
          <ColorRow label="Borde definitiva" value={cfg.summary.definitiva_border}
            onChange={(v) => upd({ summary: { ...cfg.summary, definitiva_border: v } })} />
        </>)}
        <ToggleRow label="Mostrar Posición en la Sección" value={cfg.summary.show_position}
          onChange={(v) => upd({ summary: { ...cfg.summary, show_position: v } })} />
        {cfg.summary.show_position && (<>
          <ColorRow label="Fondo posición" value={cfg.summary.position_bg}
            onChange={(v) => upd({ summary: { ...cfg.summary, position_bg: v } })} />
          <ColorRow label="Borde posición" value={cfg.summary.position_border}
            onChange={(v) => upd({ summary: { ...cfg.summary, position_border: v } })} />
        </>)}
      </Section>

      {/* Firmas */}
      <Section label="Firmas" enabled={cfg.sections.signatures} onToggle={() => sect("signatures")}>
        <p className="text-xs text-muted-foreground">
          Las líneas de firma se configuran en <strong>Planillas → Configuración General</strong>.
          Aquí solo activas o desactivas la sección.
        </p>
      </Section>
    </div>
  );
}

// ─── Scaled preview ───────────────────────────────────────────────────────────
function BoletaPreview({ cfg, paperW, paperH }: {
  cfg: BachilleratoConfig; paperW: number; paperH: number;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // "Media hoja": cada boleta usa la mitad del alto de la hoja elegida (misma regla
  // que la descarga en bachilleratoBoleta.ts) para que la vista previa sea fiel.
  const effectivePaperH =
    cfg.style === "boletin_completo" && paperH > 200 ? paperH / 2 : paperH;
  const html = useMemo(() => {
    const previewCfg = cfg.style === "boletin_completo" ? cfgForBoletinPreview(cfg) : cfg;
    if (cfg.style === "boletin_completo")
      return generateBoletinCompletoHtml(
        previewCfg,
        { ...SAMPLE_BOLETIN_COMPLETO_DATA, mention: previewCfg.boletin?.mention ?? SAMPLE_BOLETIN_COMPLETO_DATA.mention },
        paperW,
        effectivePaperH,
      );
    if (cfg.style === "primaria_descriptivo")
      return generatePrimaryDescriptiveHtml(cfg, SAMPLE_PRIMARY_DESCRIPTIVE_DATA, paperW, effectivePaperH);
    return generateBoletaHtml(cfg, SAMPLE_RENDER_DATA, paperW, effectivePaperH);
  }, [cfg, paperW, effectivePaperH]);

  const MM_TO_PX = 96 / 25.4;
  const naturalW = paperW * MM_TO_PX;
  const naturalH = effectivePaperH * MM_TO_PX;
  const previewW = 700;
  const scale = previewW / naturalW;
  const previewH = naturalH * scale;
  const [scaledContentH, setScaledContentH] = useState(previewH);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const fitHeight = () => {
      const doc = iframe.contentDocument;
      const h = doc?.body.scrollHeight ?? naturalH;
      iframe.style.height = `${h}px`;
      setScaledContentH(h * scale);
    };
    iframe.addEventListener("load", fitHeight);
    return () => iframe.removeEventListener("load", fitHeight);
  }, [html, naturalH, scale]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted-foreground">Vista previa (datos de ejemplo)</span>
      <div className="border rounded shadow-sm overflow-y-auto overflow-x-hidden bg-white"
        style={{ width: previewW, maxHeight: Math.max(previewH * 1.5, scaledContentH), position: "relative", flexShrink: 0 }}>
        <div style={{ width: previewW, height: scaledContentH, position: "relative" }}>
          <iframe
            ref={iframeRef}
            srcDoc={html}
            title="Boleta preview"
            style={{
              width: naturalW,
              height: naturalH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: "none",
              pointerEvents: "none",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────
export function BolletasFormatTab() {
  const { schoolId } = useSchoolId();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showEditor, setShowEditor] = useState(false);
  const [editItem, setEditItem] = useState<BachilleratoTemplate | null>(null);
  const [gradesOpen, setGradesOpen] = useState(false);

  const [form, setForm] = useState({ name: "", description: "", paper_width_mm: 215.9, paper_height_mm: 279.4, applicable_grades: [] as string[] });
  const [cfg, setCfg] = useState<BachilleratoConfig>(DEFAULT_BACHILLERATO_CONFIG);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["boleta-templates", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boleta_templates" as any)
        .select("*")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BachilleratoTemplate[];
    },
    enabled: !!schoolId,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        school_id: schoolId!,
        name: form.name.trim(),
        description: form.description.trim() || null,
        level: "bachillerato",
        paper_width_mm: form.paper_width_mm,
        paper_height_mm: form.paper_height_mm,
        config: cfg,
        applicable_grades: form.applicable_grades.length > 0 ? form.applicable_grades : null,
        updated_at: new Date().toISOString(),
      };
      if (editItem) {
        const { error } = await supabase.from("boleta_templates" as any).update(payload).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("boleta_templates" as any).insert({ ...payload, is_active: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boleta-templates"] });
      toast({ title: editItem ? "Plantilla actualizada" : "Plantilla creada" });
      setShowEditor(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boleta_templates" as any).update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boleta-templates"] });
      toast({ title: "Plantilla activada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deactivateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boleta_templates" as any).update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boleta-templates"] });
      toast({ title: "Plantilla desactivada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boleta_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["boleta-templates"] });
      toast({ title: "Plantilla eliminada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditItem(null);
    setForm({ name: "", description: "", paper_width_mm: 215.9, paper_height_mm: 279.4, applicable_grades: [] });
    setCfg(DEFAULT_BACHILLERATO_CONFIG);
    setShowEditor(true);
  };

  const openEdit = (t: BachilleratoTemplate) => {
    setEditItem(t);
    setForm({ name: t.name, description: t.description || "", paper_width_mm: t.paper_width_mm, paper_height_mm: t.paper_height_mm, applicable_grades: t.applicable_grades ?? [] });
    setCfg({
      ...DEFAULT_BACHILLERATO_CONFIG, ...t.config,
      sections: { ...DEFAULT_BACHILLERATO_CONFIG.sections, ...(t.config?.sections ?? {}) },
      boletin:  { ...DEFAULT_BACHILLERATO_CONFIG.boletin,  ...(t.config?.boletin  ?? {}) },
    });
    setShowEditor(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Diseña el formato visual de la boleta de Bachillerato. Configura colores, secciones y tamaño de hoja.
        </p>
        <Button onClick={openNew} className="ml-4 shrink-0">
          <Plus className="h-4 w-4 mr-1" />Nueva plantilla
        </Button>
      </div>

      {isLoading ? (
        <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-3">No hay plantillas de boleta configuradas.</p>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Crear primera plantilla</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{t.name}</p>
                      {t.is_active && <Badge className="bg-green-500 hover:bg-green-600">Activa</Badge>}
                      <Badge variant="secondary" className="text-xs">Bachillerato</Badge>
                      {t.config?.style === "boletin_completo" && (
                        <Badge variant="outline" className="text-xs">Bachillerato media hoja</Badge>
                      )}
                      {t.config?.style === "primaria_descriptivo" && (
                        <Badge variant="outline" className="text-xs">Primaria Descriptivo</Badge>
                      )}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <p className="text-xs text-muted-foreground">{t.paper_width_mm}×{t.paper_height_mm} mm</p>
                      {t.applicable_grades && t.applicable_grades.length > 0 ? (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          {t.applicable_grades.map((g) => (
                            <Badge key={g} variant="outline" className="text-xs py-0 h-4">
                              {GRADE_LABELS[g] ?? g}
                            </Badge>
                          ))}
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">·</span>
                          <Badge variant="outline" className="text-xs py-0 h-4">Todos los años</Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {t.is_active ? (
                      <Button size="sm" variant="outline" onClick={() => deactivateMut.mutate(t.id)} disabled={deactivateMut.isPending}>
                        Desactivar
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => activateMut.mutate(t.id)} disabled={activateMut.isPending}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Activar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                      <Edit className="h-4 w-4 mr-1" />Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteMut.mutate(t.id)} disabled={deleteMut.isPending}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Editor Dialog ────────────────────────────────────────────────── */}
      <Dialog open={showEditor} onOpenChange={(v) => !v && setShowEditor(false)}>
        <DialogContent
          className="max-w-[96vw] w-[1200px] flex flex-col"
          style={{ maxHeight: "95vh", overflow: "hidden" }}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editItem ? "Editar plantilla de boleta" : "Nueva plantilla de boleta"}</DialogTitle>
          </DialogHeader>

          {/* Single scrollable area — everything scrolls together */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1">

            {/* Top bar */}
            <div className="space-y-3 border-b pb-3 mb-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nombre *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Boleta Bachillerato 2026" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Opcional" className="h-8 text-sm" />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Estilo de boleta</Label>
                  <div className="flex gap-1.5">
                    {([
                      { value: "simple",               label: "Simple" },
                      { value: "boletin_completo",     label: "Bachillerato media hoja" },
                      { value: "primaria_descriptivo", label: "Primaria Descriptivo" },
                    ] as const).map(({ value, label }) => (
                      <Button key={value} size="sm"
                        variant={(cfg.style ?? "simple") === value ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setCfg((c) => ({ ...c, style: value }))}>
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Grados aplicables — accordion */}
              <div className="border rounded-md">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/50 transition-colors"
                  onClick={() => setGradesOpen((v) => !v)}
                >
                  <span>
                    Grados aplicables
                    {form.applicable_grades.length > 0 && (
                      <span className="ml-2 text-muted-foreground font-normal">
                        ({form.applicable_grades.map((g) => GRADE_LABELS[g] ?? g).join(", ")})
                      </span>
                    )}
                    {form.applicable_grades.length === 0 && (
                      <span className="ml-2 text-muted-foreground font-normal">Todos los grados</span>
                    )}
                  </span>
                  {gradesOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {gradesOpen && (
                  <div className="px-3 pb-3 pt-1 border-t space-y-2">
                    {GRADE_GROUPS.map((group) => {
                      const allChecked = group.grades.every((g) => form.applicable_grades.includes(g));
                      const someChecked = group.grades.some((g) => form.applicable_grades.includes(g));
                      return (
                        <div key={group.label}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <Checkbox
                              id={`group-${group.label}`}
                              checked={allChecked}
                              data-state={someChecked && !allChecked ? "indeterminate" : undefined}
                              onCheckedChange={(checked) =>
                                setForm((f) => ({
                                  ...f,
                                  applicable_grades: checked
                                    ? [...f.applicable_grades.filter((x) => !group.grades.includes(x as any)), ...group.grades]
                                    : f.applicable_grades.filter((x) => !group.grades.includes(x as any)),
                                }))
                              }
                            />
                            <Label htmlFor={`group-${group.label}`} className="text-xs font-semibold cursor-pointer">
                              {group.label}
                            </Label>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 pl-5">
                            {group.grades.map((g) => (
                              <div key={g} className="flex items-center gap-1">
                                <Checkbox
                                  id={`grade-${g}`}
                                  checked={form.applicable_grades.includes(g)}
                                  onCheckedChange={(checked) =>
                                    setForm((f) => ({
                                      ...f,
                                      applicable_grades: checked
                                        ? [...f.applicable_grades, g]
                                        : f.applicable_grades.filter((x) => x !== g),
                                    }))
                                  }
                                />
                                <Label htmlFor={`grade-${g}`} className="text-xs font-normal cursor-pointer">
                                  {GRADE_LABELS[g]}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">Sin selección = aplica a todos los grados</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Papel</Label>
                  <div className="flex gap-1.5">
                    {[
                      { l: "Carta", w: 215.9, h: 279.4 },
                      { l: "Media carta", w: 215.9, h: 139.7 },
                      { l: "A4", w: 210, h: 297 },
                      { l: "Oficio", w: 216, h: 356 },
                    ].map(({ l, w, h }) => (
                      <Button key={l} size="sm"
                        variant={Math.abs(form.paper_width_mm - w) < 1 && Math.abs(form.paper_height_mm - h) < 1 ? "default" : "outline"}
                        className="h-7 text-xs"
                        onClick={() => setForm((f) => ({ ...f, paper_width_mm: w, paper_height_mm: h }))}>
                        {l}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-end gap-1.5">
                  <div className="space-y-1">
                    <Label className="text-xs">Ancho mm</Label>
                    <Input type="number" value={form.paper_width_mm}
                      onChange={(e) => setForm((f) => ({ ...f, paper_width_mm: parseFloat(e.target.value) || 215.9 }))}
                      className="h-7 w-20 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Alto mm</Label>
                    <Input type="number" value={form.paper_height_mm}
                      onChange={(e) => setForm((f) => ({ ...f, paper_height_mm: parseFloat(e.target.value) || 279.4 }))}
                      className="h-7 w-20 text-xs" />
                  </div>
                </div>
              </div>
              {cfg.style === "boletin_completo" && (
                <p className="text-xs text-muted-foreground">
                  El estilo media hoja imprime cada boleta a la mitad del tamaño elegido (ej: elige Carta y saldrá en media carta).
                  En la impresora selecciona "2 páginas por hoja" para obtener dos boletas por hoja.
                </p>
              )}
            </div>

            {/* Body: config panel + preview — scroll together with the modal */}
            <div className="flex gap-4 pb-2">
              {/* Left: config — no horizontal overflow */}
              <div className="w-72 flex-shrink-0 overflow-x-hidden">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Secciones y estilos</p>
                <ConfigPanel cfg={cfg} onChange={setCfg} schoolId={schoolId ?? ""} />
              </div>
              {/* Right: preview */}
              <div className="flex-1 flex justify-center">
                <BoletaPreview cfg={cfg} paperW={form.paper_width_mm} paperH={form.paper_height_mm} />
              </div>
            </div>

          </div>{/* end single scrollable */}

          <DialogFooter className="flex-shrink-0 pt-3 border-t mt-2">
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.name.trim() || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editItem ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
