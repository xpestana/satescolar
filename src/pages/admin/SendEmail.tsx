import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Send, Loader2 } from "lucide-react";

export default function SendEmail() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isHtml, setIsHtml] = useState(false);
  const [sending, setSending] = useState(false);

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
      <PageHeader title="Enviar Email" breadcrumbs={[{ label: "Admin", href: "/dashboard" }, { label: "Enviar Email" }]} />
      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Componer Email
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
