import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Mail,
  Send,
  Loader2,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";

interface EmailTypeInfo {
  id: string;
  label: string;
  source: string;
  trigger: string;
  previewDataDesc: string;
}

const EMAIL_TYPES: EmailTypeInfo[] = [
  {
    id: "welcome-family",
    label: "Bienvenida Representante",
    source: "create-family / resend-welcome-email",
    trigger: "Registro nuevo de familia o reenvío manual desde la lista de familias",
    previewDataDesc: "Colegio Demo SAT · maria.perez@demo.com · contraseña: Demo1234",
  },
  {
    id: "welcome-teacher",
    label: "Bienvenida Docente",
    source: "create-teacher / resend-welcome-email",
    trigger: "Registro nuevo de docente o reenvío manual desde la lista de docentes",
    previewDataDesc: "Colegio Demo SAT · pedro.gomez@demo.com · contraseña: 12345678",
  },
  {
    id: "delinquency",
    label: "Aviso de Morosidad",
    source: "send-delinquency-reminders",
    trigger: "Cron programado según configuración de morosidad del colegio (diario/semanal/días del mes)",
    previewDataDesc: "Carlos Rodríguez · 5to Grado A · 3 conceptos · total: 500 VES",
  },
  {
    id: "custom-html",
    label: "Correo Personalizado HTML",
    source: "send-email + EmailComposer",
    trigger: "Envío manual desde el módulo de gestión de correos (rol school o admin)",
    previewDataDesc: "Comunicado de ejemplo con plantilla HTML estilizada con colores SAT Escolar",
  },
  {
    id: "custom-text",
    label: "Correo Personalizado Texto Plano",
    source: "send-email",
    trigger: "Envío manual desde el panel de admin o school con HTML desactivado",
    previewDataDesc: "Aviso de ejemplo en texto plano sin formato",
  },
];

interface TestResult {
  success: boolean;
  message: string;
  subject?: string;
  source?: string;
  trigger?: string;
  smtpFrom?: string;
  html?: string;
}

export default function SendEmail() {
  // Test section state
  const [testTo, setTestTo] = useState("");
  const [emailType, setEmailType] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Manual email section state
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isHtml, setIsHtml] = useState(false);
  const [sending, setSending] = useState(false);

  const selectedType = EMAIL_TYPES.find((t) => t.id === emailType);

  const handleSendTest = async () => {
    if (!testTo.trim() || !testTo.includes("@")) {
      toast.error("Ingresa un correo destino válido");
      return;
    }
    if (!emailType) {
      toast.error("Selecciona el tipo de correo a probar");
      return;
    }

    setSendingTest(true);
    setTestResult(null);
    setShowPreview(false);

    try {
      const { data, error } = await supabase.functions.invoke("send-test-email", {
        body: { to: testTo.trim(), email_type: emailType },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTestResult({
        success: true,
        message: data.message,
        subject: data.subject,
        source: data.source,
        trigger: data.trigger,
        smtpFrom: data.smtp_from,
      });
      toast.success("Correo de prueba enviado");
    } catch (err: any) {
      const msg = err?.message || "Error al enviar el correo de prueba";
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setSendingTest(false);
    }
  };

  const handleSend = async () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: to.trim(), subject: subject.trim(), body: body.trim(), isHtml },
      });

      if (error) throw error;

      toast.success(data?.message || "Email enviado exitosamente");
      setTo("");
      setSubject("");
      setBody("");
    } catch (error: any) {
      console.error("Error sending email:", error);
      toast.error(error?.message || "Error al enviar el email");
    } finally {
      setSending(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Enviar Email"
        breadcrumbs={[{ label: "Admin", href: "/dashboard" }, { label: "Enviar Email" }]}
      />
      <div className="max-w-2xl space-y-6">

        {/* ── Sección 1: Prueba de Templates ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              Probar Template de Correo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="testTo">Correo destino</Label>
              <Input
                id="testTo"
                type="email"
                placeholder="tu@correo.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El correo de prueba llegará a esta dirección con datos ficticios
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emailType">Tipo de correo</Label>
              <Select value={emailType} onValueChange={(v) => { setEmailType(v); setTestResult(null); setShowPreview(false); }}>
                <SelectTrigger id="emailType">
                  <SelectValue placeholder="Selecciona el template a probar..." />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Info card del tipo seleccionado */}
            {selectedType && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 text-blue-500 shrink-0" />
                  <span className="font-semibold text-foreground">{selectedType.label}</span>
                </div>
                <div className="space-y-1 pl-6 text-muted-foreground">
                  <p><span className="text-foreground font-medium">Función:</span> {selectedType.source}</p>
                  <p><span className="text-foreground font-medium">Trigger:</span> {selectedType.trigger}</p>
                  <p><span className="text-foreground font-medium">Datos ficticios:</span> {selectedType.previewDataDesc}</p>
                </div>
              </div>
            )}

            <Button
              onClick={handleSendTest}
              disabled={sendingTest || !testTo || !emailType}
              className="w-full"
            >
              {sendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sendingTest ? "Enviando prueba..." : "Enviar Prueba"}
            </Button>

            {/* Resultado del envío */}
            {testResult && (
              <div className={`rounded-lg border p-4 space-y-3 text-sm ${testResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                <div className="flex items-center gap-2 font-semibold">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className={testResult.success ? "text-green-700" : "text-red-700"}>
                    {testResult.message}
                  </span>
                </div>

                {testResult.success && (
                  <div className="space-y-1 text-muted-foreground pl-6">
                    {testResult.subject && (
                      <p><span className="text-foreground font-medium">Asunto enviado:</span> {testResult.subject}</p>
                    )}
                    {testResult.smtpFrom && (
                      <p><span className="text-foreground font-medium">Desde:</span> {testResult.smtpFrom}</p>
                    )}
                    {testResult.source && (
                      <p><span className="text-foreground font-medium">Función origen:</span> {testResult.source}</p>
                    )}
                    {testResult.trigger && (
                      <p><span className="text-foreground font-medium">Trigger real:</span> {testResult.trigger}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Sección 2: Correo Manual ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Correo Manual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">Destinatario(s)</Label>
              <Input
                id="to"
                placeholder="email@ejemplo.com, otro@ejemplo.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Separa múltiples destinatarios con comas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Asunto</Label>
              <Input
                id="subject"
                placeholder="Asunto del correo"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body">Mensaje</Label>
              <Textarea
                id="body"
                placeholder="Escribe tu mensaje aquí..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isHtml"
                checked={isHtml}
                onCheckedChange={setIsHtml}
              />
              <Label htmlFor="isHtml">Enviar como HTML</Label>
            </div>

            <Button onClick={handleSend} disabled={sending} className="w-full">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sending ? "Enviando..." : "Enviar Email"}
            </Button>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
}
