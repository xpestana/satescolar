import { useState, useMemo, useRef } from "react";
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
  SAMPLE_BOLETIN_COMPLETO_DATA, generateBoletinCompletoHtml,
} from "@/lib/bachilleratoTemplate";
import { Checkbox } from "@/components/ui/checkbox";
import { uploadToS3 } from "@/lib/s3-upload";

const GRADE_LABELS: Record<string, string> = {
  "1_ano": "1er Año", "2_ano": "2do Año", "3_ano": "3er Año",
  "4_ano": "4to Año", "5_ano": "5to Año", "6_ano": "6to Año",
};
const BACHILLERATO_GRADES = ["1_ano", "2_ano", "3_ano", "4_ano", "5_ano", "6_ano"] as const;

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
          <NumRow label="Margen inferior / firmas" unit="mm" min={0} max={60}
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
        <Section label="Firmas" enabled={cfg.sections.signatures} onToggle={() => sect("signatures")}>
          {cfg.sections.signatures && (
            <SignatureEditor
              sigs={cfg.boletin?.signatures ?? []}
              onChange={(s) => updBoletin({ signatures: s })}
              schoolId={schoolId}
            />
          )}
        </Section>
      </div>
    );
  }

  // ── Simple style ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "calc(70vh - 120px)" }}>

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
  const html = useMemo(
    () => cfg.style === "boletin_completo"
      ? generateBoletinCompletoHtml(cfg, SAMPLE_BOLETIN_COMPLETO_DATA, paperW, paperH)
      : generateBoletaHtml(cfg, SAMPLE_RENDER_DATA, paperW, paperH),
    [cfg, paperW, paperH],
  );

  const MM_TO_PX = 96 / 25.4;
  const naturalW = paperW * MM_TO_PX;
  const naturalH = paperH * MM_TO_PX;
  const previewW = 580;
  const scale = previewW / naturalW;
  const previewH = naturalH * scale;

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-muted-foreground">Vista previa (datos de ejemplo)</span>
      <div className="border rounded shadow-sm overflow-hidden bg-white"
        style={{ width: previewW, height: previewH, position: "relative" }}>
        <iframe
          srcDoc={html}
          title="Boleta preview"
          style={{
            width: naturalW,
            height: naturalH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            border: "none",
            pointerEvents: "none",
          }}
        />
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
        .eq("level", "bachillerato")
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
                        <Badge variant="outline" className="text-xs">Boletín Completo</Badge>
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
          className="max-w-[96vw] w-[1150px]"
          style={{ maxHeight: "95vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editItem ? "Editar plantilla de boleta" : "Nueva plantilla de boleta"}</DialogTitle>
          </DialogHeader>

          {/* Top bar */}
          <div className="flex-shrink-0 space-y-3 border-b pb-3">
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
                    { value: "simple",           label: "Simple" },
                    { value: "boletin_completo",  label: "Boletín Completo" },
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
            <div className="space-y-1.5">
              <Label className="text-xs">Grados aplicables</Label>
              <div className="flex flex-wrap gap-3">
                {BACHILLERATO_GRADES.map((g) => (
                  <div key={g} className="flex items-center gap-1.5">
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
              <p className="text-xs text-muted-foreground">Sin selección = aplica a todos los años</p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Papel</Label>
                <div className="flex gap-1.5">
                  {[
                    { l: "Carta", w: 215.9, h: 279.4 },
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
          </div>

          {/* Body: config panel + preview */}
          <div className="flex-1 min-h-0 flex gap-4 overflow-hidden pt-2">
            {/* Left: config */}
            <div className="w-72 flex-shrink-0 flex flex-col overflow-hidden">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex-shrink-0">Secciones y estilos</p>
              <div className="flex-1 overflow-y-auto pr-1">
                <ConfigPanel cfg={cfg} onChange={setCfg} schoolId={schoolId ?? ""} />
              </div>
            </div>
            {/* Right: preview */}
            <div className="flex-1 overflow-y-auto flex justify-center">
              <BoletaPreview cfg={cfg} paperW={form.paper_width_mm} paperH={form.paper_height_mm} />
            </div>
          </div>

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
