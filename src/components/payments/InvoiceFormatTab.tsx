import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Loader2, CheckCircle2, Eye } from "lucide-react";
import { uploadToS3 } from "@/lib/s3-upload";
import { InvoiceCanvasEditor } from "@/components/payments/InvoiceCanvasEditor";
import { InvoiceOverlayPreview } from "@/components/payments/InvoiceOverlayPreview";
import type { InvoiceTemplate, OverlayField } from "@/pages/school/InvoiceTemplateConfig";

export function InvoiceFormatTab() {
  const { schoolId } = useSchoolId();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editTemplate, setEditTemplate] = useState<InvoiceTemplate | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<InvoiceTemplate | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
    paper_width_mm: 215.9,
    paper_height_mm: 279.4,
    background_image_url: "",
  });
  const [fields, setFields] = useState<OverlayField[]>([]);

  const { data: schoolConcepts = [] } = useQuery({
    queryKey: ["payment-concepts-invoice", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_concepts")
        .select("id, name")
        .eq("school_id", schoolId!)
        .eq("is_active", true)
        .order("name");
      return (data || []) as { id: string; name: string }[];
    },
    enabled: !!schoolId,
  });

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
        fields,
        updated_at: new Date().toISOString(),
      };
      if (editTemplate) {
        const { error } = await supabase.from("invoice_templates" as any).update(payload).eq("id", editTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("invoice_templates" as any).insert({ ...payload, is_active: false });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      qc.invalidateQueries({ queryKey: ["active-invoice-template"] });
      toast({ title: editTemplate ? "Plantilla actualizada" : "Plantilla creada" });
      setShowEditor(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase.from("invoice_templates" as any).update({ is_active: false }).eq("school_id", schoolId!);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("invoice_templates" as any).update({ is_active: true }).eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      qc.invalidateQueries({ queryKey: ["active-invoice-template"] });
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
      qc.invalidateQueries({ queryKey: ["active-invoice-template"] });
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

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Diseña visualmente dónde imprimir cada dato sobre la factura física. Pon la factura en blanco en la impresora y los datos se imprimen encima.
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
                      <Button size="sm" variant="outline" onClick={() => activateMut.mutate(t.id)} disabled={activateMut.isPending}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Activar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => { setPreviewTemplate(t); setShowPreview(true); }}>
                      <Eye className="h-4 w-4 mr-1" />Preview
                    </Button>
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

      {/* Visual Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={(v) => !v && setShowEditor(false)}>
        <DialogContent className="max-w-[95vw] w-[1100px]" style={{ maxHeight: "95vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>{editTemplate ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
          </DialogHeader>

          <div className="flex-shrink-0 space-y-3 border-b pb-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Factura MLK 2026"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Ej: Serie 016501–017000"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Papel</Label>
                <div className="flex gap-1.5">
                  <Button size="sm" variant={Math.abs(form.paper_width_mm - 215.9) < 1 ? "default" : "outline"} className="h-7 text-xs" onClick={() => setForm((f) => ({ ...f, paper_width_mm: 215.9, paper_height_mm: 279.4 }))}>Carta</Button>
                  <Button size="sm" variant={Math.abs(form.paper_width_mm - 210) < 1 ? "default" : "outline"} className="h-7 text-xs" onClick={() => setForm((f) => ({ ...f, paper_width_mm: 210, paper_height_mm: 297 }))}>A4</Button>
                  <Button size="sm" variant={Math.abs(form.paper_width_mm - 216) < 1 && Math.abs(form.paper_height_mm - 356) < 1 ? "default" : "outline"} className="h-7 text-xs" onClick={() => setForm((f) => ({ ...f, paper_width_mm: 216, paper_height_mm: 356 }))}>Oficio</Button>
                </div>
              </div>
              <div className="flex items-end gap-1.5">
                <div className="space-y-1">
                  <Label className="text-xs">Ancho mm</Label>
                  <Input type="number" value={form.paper_width_mm} onChange={(e) => setForm((f) => ({ ...f, paper_width_mm: parseFloat(e.target.value) || 215.9 }))} className="h-7 w-20 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Alto mm</Label>
                  <Input type="number" value={form.paper_height_mm} onChange={(e) => setForm((f) => ({ ...f, paper_height_mm: parseFloat(e.target.value) || 279.4 }))} className="h-7 w-20 text-xs" />
                </div>
              </div>
              <div className="flex items-end gap-2">
                <label className="cursor-pointer">
                  <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                    <span>
                      {uploading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                      {form.background_image_url ? "Cambiar fondo" : "Subir factura en blanco"}
                    </span>
                  </Button>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadBackground(e.target.files[0])} />
                </label>
                {form.background_image_url && <span className="text-xs text-green-600">✓ fondo cargado</span>}
                {form.background_image_url && (
                  <button className="text-xs text-muted-foreground underline" onClick={() => setForm((f) => ({ ...f, background_image_url: "" }))}>quitar</button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 pt-2">
            <InvoiceCanvasEditor
              fields={fields}
              onChange={setFields}
              paperWidthMm={form.paper_width_mm}
              paperHeightMm={form.paper_height_mm}
              backgroundUrl={form.background_image_url || undefined}
              schoolConcepts={schoolConcepts}
            />
          </div>

          <DialogFooter className="flex-shrink-0 pt-3 border-t mt-2">
            <Button variant="outline" onClick={() => setShowEditor(false)}>Cancelar</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!form.name.trim() || saveMut.isPending}>
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
    </>
  );
}
