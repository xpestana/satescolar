import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, CheckCircle2, Eye } from "lucide-react";
import { uploadToS3 } from "@/lib/s3-upload";
import { InvoiceOverlayPreview } from "@/components/payments/InvoiceOverlayPreview";

// Fields available for positioning on the invoice overlay
export const OVERLAY_FIELDS = [
  { key: "invoice_number", label: "N° Factura", example: "016725" },
  { key: "date_day", label: "Fecha – Día", example: "11" },
  { key: "date_month", label: "Fecha – Mes", example: "5" },
  { key: "date_year", label: "Fecha – Año", example: "2026" },
  { key: "titular_nombre", label: "Nombre / Razón Social", example: "Juan Pérez" },
  { key: "titular_ci", label: "C.I. / RIF", example: "V-12345678" },
  { key: "student_name", label: "Para acreditar a (estudiante)", example: "Ana García" },
  { key: "student_grade", label: "Grado", example: "3°" },
  { key: "student_section", label: "Sección", example: "A" },
  { key: "concept_1_name", label: "Concepto 1 – Descripción", example: "Mensualidad Septiembre" },
  { key: "concept_1_amount", label: "Concepto 1 – Monto", example: "5.000,00" },
  { key: "concept_2_name", label: "Concepto 2 – Descripción", example: "Seguro Escolar" },
  { key: "concept_2_amount", label: "Concepto 2 – Monto", example: "1.200,00" },
  { key: "concept_3_name", label: "Concepto 3 – Descripción", example: "Comunidad Educativa" },
  { key: "concept_3_amount", label: "Concepto 3 – Monto", example: "800,00" },
  { key: "concept_4_name", label: "Concepto 4 – Descripción", example: "" },
  { key: "concept_4_amount", label: "Concepto 4 – Monto", example: "" },
  { key: "concept_5_name", label: "Concepto 5 – Descripción", example: "" },
  { key: "concept_5_amount", label: "Concepto 5 – Monto", example: "" },
  { key: "total_amount", label: "Monto Total", example: "7.000,00" },
  { key: "payment_method_text", label: "Forma de pago", example: "Zelle (USD)" },
];

export interface OverlayField {
  key: string;
  x_mm: number;
  y_mm: number;
  font_size_pt: number;
  width_mm: number;
  bold?: boolean;
}

export interface InvoiceTemplate {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  paper_width_mm: number;
  paper_height_mm: number;
  background_image_url: string | null;
  fields: OverlayField[];
  is_active: boolean;
  created_at: string;
}

const DEFAULT_FIELD: Omit<OverlayField, "key"> = {
  x_mm: 20,
  y_mm: 40,
  font_size_pt: 9,
  width_mm: 80,
};

export default function InvoiceTemplateConfig() {
  const { schoolId } = useSchoolId();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editTemplate, setEditTemplate] = useState<InvoiceTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<InvoiceTemplate | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form state for new/edit template
  const [form, setForm] = useState({
    name: "",
    description: "",
    paper_width_mm: 215.9,
    paper_height_mm: 279.4,
    background_image_url: "",
  });
  const [fields, setFields] = useState<OverlayField[]>([]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["invoice-templates", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_templates" as any)
        .select("*")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as InvoiceTemplate[];
    },
    enabled: !!schoolId,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        school_id: schoolId!,
        name: form.name.trim(),
        description: form.description.trim() || null,
        paper_width_mm: form.paper_width_mm,
        paper_height_mm: form.paper_height_mm,
        background_image_url: form.background_image_url || null,
        fields: fields,
        updated_at: new Date().toISOString(),
      };
      if (editTemplate) {
        const { error } = await supabase
          .from("invoice_templates" as any)
          .update(payload)
          .eq("id", editTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("invoice_templates" as any)
          .insert({ ...payload, is_active: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast({ title: editTemplate ? "Plantilla actualizada" : "Plantilla creada" });
      setShowEditor(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activateMut = useMutation({
    mutationFn: async (id: string) => {
      // Deactivate all, then activate selected
      const { error: err1 } = await supabase
        .from("invoice_templates" as any)
        .update({ is_active: false })
        .eq("school_id", schoolId!);
      if (err1) throw err1;
      const { error: err2 } = await supabase
        .from("invoice_templates" as any)
        .update({ is_active: true })
        .eq("id", id);
      if (err2) throw err2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast({ title: "Plantilla activada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast({ title: "Plantilla eliminada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditTemplate(null);
    setForm({ name: "", description: "", paper_width_mm: 215.9, paper_height_mm: 279.4, background_image_url: "" });
    setFields([]);
    setShowEditor(true);
  };

  const openEdit = (t: InvoiceTemplate) => {
    setEditTemplate(t);
    setForm({
      name: t.name,
      description: t.description || "",
      paper_width_mm: t.paper_width_mm,
      paper_height_mm: t.paper_height_mm,
      background_image_url: t.background_image_url || "",
    });
    setFields(t.fields || []);
    setShowEditor(true);
  };

  const uploadBackground = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadToS3({ file, folder: "assets", schoolId: schoolId!, entityId: "invoice-templates" });
      setForm((f) => ({ ...f, background_image_url: result.publicUrl }));
    } catch (e: any) {
      toast({ title: "Error al subir imagen", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const updateField = (key: string, prop: keyof OverlayField, value: any) => {
    setFields((prev) => {
      const existing = prev.find((f) => f.key === key);
      if (existing) {
        return prev.map((f) => (f.key === key ? { ...f, [prop]: value } : f));
      }
      return [...prev, { key, ...DEFAULT_FIELD, [prop]: value }];
    });
  };

  const toggleField = (key: string) => {
    setFields((prev) => {
      const exists = prev.find((f) => f.key === key);
      if (exists) return prev.filter((f) => f.key !== key);
      return [...prev, { key, ...DEFAULT_FIELD }];
    });
  };

  const getField = (key: string): OverlayField | undefined => fields.find((f) => f.key === key);

  return (
    <DashboardLayout>
      <PageHeader
        title="Formato de Factura"
        breadcrumbs={[
          { label: "Pagos", href: "/pagos/configuracion" },
          { label: "Formato de Factura" },
        ]}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva plantilla
          </Button>
        }
      />

      <p className="text-sm text-muted-foreground mb-4">
        Configura la posición de cada dato sobre la factura física del colegio. Al imprimir, los datos se superponen
        sobre el formulario en blanco que colocas en la impresora.
      </p>

      {isLoading ? (
        <div className="py-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="mb-3">No hay plantillas de factura configuradas.</p>
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
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{t.name}</p>
                      {t.is_active && <Badge className="bg-green-500 hover:bg-green-600">Activa</Badge>}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.paper_width_mm}×{t.paper_height_mm} mm · {(t.fields || []).length} campos configurados
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!t.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => activateMut.mutate(t.id)}
                        disabled={activateMut.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />Activar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setPreviewTemplate(t); setShowPreview(true); }}
                    >
                      <Eye className="h-4 w-4 mr-1" />Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                      <Edit className="h-4 w-4 mr-1" />Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMut.mutate(t.id)}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={(v) => !v && setShowEditor(false)}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nombre de la plantilla *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Factura MLK 2026"
                />
              </div>
              <div className="space-y-1">
                <Label>Descripción (opcional)</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Formato carta, serie 016501–017000"
                />
              </div>
            </div>

            {/* Paper size */}
            <div>
              <p className="text-sm font-medium mb-2">Tamaño del papel (mm)</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Ancho (mm)</Label>
                  <Input
                    type="number"
                    value={form.paper_width_mm}
                    onChange={(e) => setForm((f) => ({ ...f, paper_width_mm: parseFloat(e.target.value) || 215.9 }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Alto (mm)</Label>
                  <Input
                    type="number"
                    value={form.paper_height_mm}
                    onChange={(e) => setForm((f) => ({ ...f, paper_height_mm: parseFloat(e.target.value) || 279.4 }))}
                  />
                </div>
                <div className="col-span-2 flex gap-2 items-end pb-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm((f) => ({ ...f, paper_width_mm: 215.9, paper_height_mm: 279.4 }))}
                  >
                    Carta (Letter)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm((f) => ({ ...f, paper_width_mm: 210, paper_height_mm: 297 }))}
                  >
                    A4
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setForm((f) => ({ ...f, paper_width_mm: 216, paper_height_mm: 356 }))}
                  >
                    Oficio
                  </Button>
                </div>
              </div>
            </div>

            {/* Background image */}
            <div className="space-y-2">
              <Label>Imagen de fondo (escaneo de la factura en blanco)</Label>
              <p className="text-xs text-muted-foreground">
                Sube un escaneo de la factura en blanco. Se usará solo como referencia visual en el editor.
              </p>
              <div className="flex gap-3 items-center">
                <label className="cursor-pointer">
                  <Button size="sm" variant="outline" asChild>
                    <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Subir imagen</span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadBackground(e.target.files[0])}
                  />
                </label>
                {form.background_image_url && (
                  <span className="text-xs text-green-600">✓ Imagen subida</span>
                )}
              </div>
              {form.background_image_url && (
                <div className="border rounded overflow-hidden max-h-48">
                  <img src={form.background_image_url} alt="Factura" className="w-full object-contain" />
                </div>
              )}
            </div>

            {/* Fields configuration */}
            <div>
              <p className="text-sm font-semibold mb-1">Posición de campos (en mm desde la esquina superior izquierda)</p>
              <p className="text-xs text-muted-foreground mb-3">
                Activa cada campo que quieras imprimir y configura su posición exacta. Usa el preview para verificar.
              </p>

              <div className="space-y-1">
                {/* Header row */}
                <div className="grid grid-cols-[20px_160px_70px_70px_60px_60px_50px] gap-2 text-xs font-medium text-muted-foreground px-2 mb-1">
                  <span></span>
                  <span>Campo</span>
                  <span>X (mm)</span>
                  <span>Y (mm)</span>
                  <span>Ancho</span>
                  <span>Fuente pt</span>
                  <span>Negrita</span>
                </div>

                {OVERLAY_FIELDS.map((f) => {
                  const cfg = getField(f.key);
                  const active = !!cfg;
                  return (
                    <div
                      key={f.key}
                      className={`grid grid-cols-[20px_160px_70px_70px_60px_60px_50px] gap-2 items-center px-2 py-1 rounded ${active ? "bg-blue-50" : "hover:bg-muted/30"}`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleField(f.key)}
                        className="h-4 w-4"
                      />
                      <div>
                        <p className="text-xs font-medium">{f.label}</p>
                        {f.example && <p className="text-[10px] text-muted-foreground">Ej: {f.example}</p>}
                      </div>
                      <Input
                        type="number"
                        disabled={!active}
                        value={cfg?.x_mm ?? ""}
                        onChange={(e) => updateField(f.key, "x_mm", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs"
                        step={0.5}
                      />
                      <Input
                        type="number"
                        disabled={!active}
                        value={cfg?.y_mm ?? ""}
                        onChange={(e) => updateField(f.key, "y_mm", parseFloat(e.target.value) || 0)}
                        className="h-7 text-xs"
                        step={0.5}
                      />
                      <Input
                        type="number"
                        disabled={!active}
                        value={cfg?.width_mm ?? ""}
                        onChange={(e) => updateField(f.key, "width_mm", parseFloat(e.target.value) || 50)}
                        className="h-7 text-xs"
                        step={1}
                      />
                      <Input
                        type="number"
                        disabled={!active}
                        value={cfg?.font_size_pt ?? ""}
                        onChange={(e) => updateField(f.key, "font_size_pt", parseFloat(e.target.value) || 9)}
                        className="h-7 text-xs"
                        step={0.5}
                      />
                      <input
                        type="checkbox"
                        disabled={!active}
                        checked={cfg?.bold ?? false}
                        onChange={(e) => updateField(f.key, "bold", e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancelar</Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!form.name.trim() || saveMut.isPending}
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editTemplate ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewTemplate && (
        <Dialog open={showPreview} onOpenChange={(v) => !v && setShowPreview(false)}>
          <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Preview – {previewTemplate.name}</DialogTitle>
            </DialogHeader>
            <InvoiceOverlayPreview template={previewTemplate} />
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
