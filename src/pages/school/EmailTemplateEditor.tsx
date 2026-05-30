import { useState, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RichTextEditor, RichTextEditorHandle } from "@/components/utilities/RichTextEditor";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { getContrastTextColor } from "@/lib/color-utils";
import { buildEmailPreviewHtml } from "@/lib/email-preview";
import { toast } from "sonner";
import {
  Save,
  RotateCcw,
  Send,
  Loader2,
  ArrowLeft,
  Info,
  Type,
} from "lucide-react";

type TemplateType = "welcome-family" | "welcome-teacher" | "delinquency" | "payment-reminder";

const TYPE_LABELS: Record<TemplateType, string> = {
  "welcome-family": "Bienvenida Representante",
  "welcome-teacher": "Bienvenida Docente",
  delinquency: "Aviso de Morosidad",
  "payment-reminder": "Recordatorio de Cuotas",
};

const TYPE_SNIPPETS: Record<TemplateType, { key: string; label: string }[]> = {
  "welcome-family": [
    { key: "nombre_colegio", label: "Nombre del colegio" },
    { key: "email_usuario", label: "Email del representante" },
    { key: "contrasena", label: "Contraseña generada" },
    { key: "url_plataforma", label: "Link de acceso" },
  ],
  "welcome-teacher": [
    { key: "nombre_colegio", label: "Nombre del colegio" },
    { key: "email_usuario", label: "Email del docente" },
    { key: "contrasena", label: "Contraseña generada" },
    { key: "url_plataforma", label: "Link de acceso" },
  ],
  delinquency: [
    { key: "nombre_colegio", label: "Nombre del colegio" },
    { key: "nombre_estudiante", label: "Nombre del estudiante" },
    { key: "grado_seccion", label: "Grado y sección" },
    { key: "conceptos_pendientes", label: "Lista de conceptos" },
    { key: "total_adeudado", label: "Total adeudado" },
    { key: "telefono_colegio", label: "Teléfono del colegio" },
    { key: "email_colegio", label: "Email del colegio" },
  ],
  "payment-reminder": [
    { key: "nombre_colegio", label: "Nombre del colegio" },
    { key: "nombre_estudiante", label: "Nombre del estudiante" },
    { key: "grado_seccion", label: "Grado y sección" },
    { key: "conceptos_pendientes", label: "Lista de conceptos" },
    { key: "total_adeudado", label: "Monto pendiente" },
    { key: "telefono_colegio", label: "Teléfono del colegio" },
    { key: "email_colegio", label: "Email del colegio" },
  ],
};

const DEFAULT_SUBJECTS: Record<TemplateType, string> = {
  "welcome-family": "Bienvenido/a a {{nombre_colegio}} - SAT Escolar",
  "welcome-teacher": "Bienvenido/a a {{nombre_colegio}} - SAT Escolar",
  delinquency: "Recordatorio de Pago Pendiente - {{nombre_estudiante}}",
  "payment-reminder": "Recordatorio de Cuota - {{nombre_estudiante}}",
};

const DEFAULT_BODIES: Record<TemplateType, string> = {
  "welcome-family": `<h2>¡Bienvenido/a!</h2>
<p>Ha sido registrado como <strong>representante</strong> en <strong>{{nombre_colegio}}</strong> a través de la plataforma <strong>SAT Escolar</strong>.</p>
<p>Sus credenciales de acceso:</p>
<p><strong>Usuario:</strong> {{email_usuario}}<br/><strong>Contraseña:</strong> {{contrasena}}</p>
<p style="text-align:center;"><a href="{{url_plataforma}}" style="display:inline-block;padding:12px 28px;background-color:#1e78c8;color:#ffffff;font-weight:bold;text-decoration:none;border-radius:8px;">Ingresar a la Plataforma</a></p>
<p style="font-size:13px;color:#9ca3af;text-align:center;">Le recomendamos cambiar su contraseña una vez ingrese al sistema.</p>`,

  "welcome-teacher": `<h2>¡Bienvenido/a!</h2>
<p>Ha sido registrado como <strong>docente</strong> en <strong>{{nombre_colegio}}</strong> a través de la plataforma <strong>SAT Escolar</strong>.</p>
<p>Sus credenciales de acceso:</p>
<p><strong>Usuario:</strong> {{email_usuario}}<br/><strong>Contraseña:</strong> {{contrasena}}</p>
<p style="text-align:center;"><a href="{{url_plataforma}}" style="display:inline-block;padding:12px 28px;background-color:#1e78c8;color:#ffffff;font-weight:bold;text-decoration:none;border-radius:8px;">Ingresar a la Plataforma</a></p>
<p style="font-size:13px;color:#9ca3af;text-align:center;">Le recomendamos cambiar su contraseña una vez ingrese al sistema.</p>`,

  delinquency: `<h2>Recordatorio de Pago Pendiente</h2>
<p>Estimado(a) representante,</p>
<p>Le informamos que <strong>{{nombre_estudiante}}</strong> ({{grado_seccion}}) presenta un saldo pendiente en <strong>{{nombre_colegio}}</strong>.</p>
<h3>Conceptos pendientes:</h3>
{{conceptos_pendientes}}
<p style="font-size:18px;color:#c0392b;"><strong>Total pendiente: {{total_adeudado}}</strong></p>
<p>Le invitamos a regularizar su situación. Si ya realizó el pago, háganos llegar el comprobante.</p>
<p>Contáctenos:<br/>Teléfono: {{telefono_colegio}}<br/>Email: {{email_colegio}}</p>
<p>Atentamente,<br/><strong>{{nombre_colegio}}</strong></p>`,

  "payment-reminder": `<h2>Recordatorio de Cuota</h2>
<p>Estimado(a) representante,</p>
<p>Le recordamos que <strong>{{nombre_estudiante}}</strong> ({{grado_seccion}}) tiene cuotas próximas a vencer en <strong>{{nombre_colegio}}</strong>.</p>
<h3>Detalle:</h3>
{{conceptos_pendientes}}
<p><strong>Total: {{total_adeudado}}</strong></p>
<p>Para consultas:<br/>Teléfono: {{telefono_colegio}}<br/>Email: {{email_colegio}}</p>
<p>Atentamente,<br/><strong>{{nombre_colegio}}</strong></p>`,
};

export default function EmailTemplateEditor() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { schoolId } = useSchoolId();
  const { school } = useSchoolData();
  const queryClient = useQueryClient();
  const editorRef = useRef<RichTextEditorHandle>(null);

  const templateType = type as TemplateType;
  const snippets = TYPE_SNIPPETS[templateType] ?? [];

  const [subject, setSubject] = useState(DEFAULT_SUBJECTS[templateType] ?? "");
  const [bodyHtml, setBodyHtml] = useState(DEFAULT_BODIES[templateType] ?? "");
  const [primaryColor, setPrimaryColor] = useState("#1e78c8");
  const [testEmail, setTestEmail] = useState("");
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const textColor = getContrastTextColor(primaryColor);

  const { data: existingTemplate } = useQuery({
    queryKey: ["email-template", schoolId, templateType],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("*")
        .eq("school_id", schoolId!)
        .eq("template_type", templateType)
        .maybeSingle();
      return data;
    },
    enabled: !!schoolId && !!templateType,
  });

  // Sync form from DB once loaded
  if (existingTemplate && existingTemplate.id !== loadedId) {
    setLoadedId(existingTemplate.id);
    setSubject(existingTemplate.subject);
    setBodyHtml(existingTemplate.body_html);
    setPrimaryColor(existingTemplate.primary_color);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        school_id: schoolId!,
        template_type: templateType,
        subject,
        body_html: bodyHtml,
        primary_color: primaryColor,
        text_color: textColor,
        is_active: true,
        updated_at: new Date().toISOString(),
      };
      if (existingTemplate) {
        const { error } = await supabase
          .from("email_templates")
          .update(payload)
          .eq("id", existingTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates", schoolId] });
      queryClient.invalidateQueries({ queryKey: ["email-template", schoolId, templateType] });
      toast.success("Template guardado");
    },
    onError: (e: any) => toast.error(e.message || "Error al guardar"),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!existingTemplate) return;
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", existingTemplate.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates", schoolId] });
      queryClient.invalidateQueries({ queryKey: ["email-template", schoolId, templateType] });
      setLoadedId(null);
      setSubject(DEFAULT_SUBJECTS[templateType] ?? "");
      setBodyHtml(DEFAULT_BODIES[templateType] ?? "");
      setPrimaryColor("#1e78c8");
      setResetDialogOpen(false);
      toast.success("Template restaurado al diseño por defecto");
    },
    onError: (e: any) => toast.error(e.message || "Error al restaurar"),
  });

  const handleSendTest = async () => {
    if (!testEmail.trim() || !testEmail.includes("@")) {
      toast.error("Ingresa un correo destino válido");
      return;
    }
    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: {
          to: testEmail.trim(),
          email_type: templateType,
          school_id: schoolId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Correo de prueba enviado a ${testEmail}`);
      setTestDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Error al enviar la prueba");
    } finally {
      setSendingTest(false);
    }
  };

  const previewHtml = useMemo(
    () =>
      buildEmailPreviewHtml(
        templateType,
        bodyHtml,
        primaryColor,
        textColor,
        school?.name ?? "Nombre del Colegio",
        school?.logo_url ?? null
      ),
    [templateType, bodyHtml, primaryColor, textColor, school]
  );

  if (!TYPE_LABELS[templateType]) {
    return null;
  }

  return (
    <DashboardLayout>
      <PageHeader
        title={TYPE_LABELS[templateType]}
        breadcrumbs={[
          { label: "Ajustes" },
          { label: "Templates de Correo", href: "/school/configuraciones/correos" },
          { label: TYPE_LABELS[templateType] },
        ]}
      />

      <div className="flex gap-6 items-start">
        {/* ── Columna izquierda: controles ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Asunto */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Type className="h-4 w-4" />
                Asunto del correo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Asunto del correo..."
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Puedes usar snippets como <code className="bg-muted px-1 rounded">{"{{nombre_colegio}}"}</code> en el asunto también.
              </p>
            </CardContent>
          </Card>

          {/* Color */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Color del encabezado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 rounded cursor-pointer border border-input"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setPrimaryColor(v);
                  }}
                  className="w-32 font-mono text-sm"
                  maxLength={7}
                />
                <Badge
                  style={{ backgroundColor: primaryColor, color: textColor }}
                  className="text-xs"
                >
                  {textColor === "#ffffff" ? "Texto blanco" : "Texto negro"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Snippets */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4" />
                Datos disponibles (snippets)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Haz clic en un snippet para insertarlo en la posición del cursor dentro del editor.
              </p>
              <div className="flex flex-wrap gap-2">
                {snippets.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => editorRef.current?.insertAtCursor(`{{${s.key}}}`)}
                    className="inline-flex items-center gap-1 rounded border border-dashed border-primary/50 bg-primary/5 px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors font-mono"
                    title={s.label}
                  >
                    {`{{${s.key}}}`}
                    <span className="text-muted-foreground font-sans normal-case ml-1">{s.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cuerpo del correo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Cuerpo del correo</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                ref={editorRef}
                value={bodyHtml}
                onChange={setBodyHtml}
                placeholder="Escribe el contenido del correo..."
                minHeight={300}
              />
            </CardContent>
          </Card>

          {/* Acciones */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar template
            </Button>

            <Button
              variant="outline"
              onClick={() => setTestDialogOpen(true)}
            >
              <Send className="h-4 w-4 mr-2" />
              Enviar prueba
            </Button>

            {existingTemplate && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setResetDialogOpen(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Restaurar defecto
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={() => navigate("/school/configuraciones/correos")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
        </div>

        {/* ── Columna derecha: preview sticky ── */}
        <div className="w-[480px] shrink-0 sticky top-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Preview en vivo</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <iframe
                srcDoc={previewHtml}
                className="w-full rounded-b-lg"
                style={{ height: "600px", border: "none" }}
                sandbox="allow-same-origin"
                title="Email preview"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: enviar prueba */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar correo de prueba</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              El correo se enviará con datos ficticios al correo que indiques, usando el template personalizado actual.
            </p>
            <div className="space-y-1.5">
              <Label>Correo destino</Label>
              <Input
                type="email"
                placeholder="tu@correo.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendTest()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendTest} disabled={sendingTest}>
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar prueba
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: restaurar defecto */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar al diseño por defecto?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la personalización del template "{TYPE_LABELS[templateType]}". El colegio volverá a usar el diseño estándar de SAT Escolar. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => resetMutation.mutate()}
            >
              Restaurar defecto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
