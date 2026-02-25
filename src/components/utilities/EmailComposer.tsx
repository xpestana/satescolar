import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { useCarnetConfig } from "@/hooks/useCarnetConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  X,
  Users,
  GraduationCap,
  Home,
  Plus,
  Mail,
  Eye,
  ChevronDown,
} from "lucide-react";

interface Recipient {
  email: string;
  name: string;
  type: "teacher" | "family" | "manual";
}

function buildEmailHtml(
  subject: string,
  body: string,
  primaryColor: string,
  secondaryColor: string,
  logoUrl: string | null,
  schoolName: string
) {
  const bodyHtml = body.replace(/\n/g, "<br/>");
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
  <!-- Header -->
  <tr><td style="background-color:${primaryColor};padding:32px 40px;text-align:center;">
    ${logoUrl ? `<img src="${logoUrl}" alt="${schoolName}" style="max-height:60px;max-width:200px;margin-bottom:12px;" />` : ""}
    <h2 style="color:#ffffff;margin:0;font-size:18px;font-weight:600;letter-spacing:0.5px;">${schoolName}</h2>
  </td></tr>
  <!-- Body -->
  <tr><td style="padding:40px;">
    <h1 style="color:${primaryColor};font-size:22px;font-weight:700;margin:0 0 24px 0;line-height:1.3;">${subject}</h1>
    <div style="color:#374151;font-size:15px;line-height:1.7;">${bodyHtml}</div>
  </td></tr>
  <!-- Footer -->
  <tr><td style="background-color:${primaryColor};padding:24px 40px;text-align:center;">
    <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0;">Desarrollado por <a href="https://satescolar.com" style="color:${secondaryColor};text-decoration:none;font-weight:600;">SATEscolar</a></p>
    <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:4px 0 0 0;">satescolar.com</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export default function EmailComposer() {
  const { schoolId } = useSchoolId();
  const { school } = useSchoolData();
  const { data: carnetConfig } = useCarnetConfig(schoolId);

  const primaryColor = carnetConfig?.primary_color || "#01051e";
  const secondaryColor = carnetConfig?.secondary_color || "#1e78c8";

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [manualEmail, setManualEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [teacherPopoverOpen, setTeacherPopoverOpen] = useState(false);
  const [familyPopoverOpen, setFamilyPopoverOpen] = useState(false);

  // Fetch teachers
  const { data: teachers = [] } = useQuery({
    queryKey: ["email-teachers", schoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teachers")
        .select("id, email, form_data")
        .eq("school_id", schoolId!)
        .eq("is_suspended", false);
      if (error) throw error;
      return (data || []).filter((t) => t.email);
    },
    enabled: !!schoolId,
  });

  // Fetch families (representatives with emails via family_schools)
  const { data: familyReps = [] } = useQuery({
    queryKey: ["email-families", schoolId],
    queryFn: async () => {
      const { data: familySchools, error: fsError } = await supabase
        .from("family_schools")
        .select("family_id")
        .eq("school_id", schoolId!);
      if (fsError) throw fsError;
      if (!familySchools?.length) return [];

      const familyIds = familySchools.map((fs) => fs.family_id);
      const { data: reps, error } = await supabase
        .from("representatives")
        .select("id, email, form_data, family_id, is_primary")
        .in("family_id", familyIds);
      if (error) throw error;

      // Group by family, prefer primary
      const byFamily = new Map<string, typeof reps[0]>();
      for (const rep of reps || []) {
        if (!rep.email) continue;
        const existing = byFamily.get(rep.family_id);
        if (!existing || (rep.is_primary && !existing.is_primary)) {
          byFamily.set(rep.family_id, rep);
        }
      }
      return Array.from(byFamily.values());
    },
    enabled: !!schoolId,
  });

  const getTeacherName = (t: { form_data: any }) => {
    const fd = t.form_data as Record<string, string> | null;
    if (!fd) return "Docente";
    return [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ") || "Docente";
  };

  const getRepName = (r: { form_data: any }) => {
    const fd = r.form_data as Record<string, string> | null;
    if (!fd) return "Representante";
    return [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ") || "Representante";
  };

  const addRecipient = (r: Recipient) => {
    if (!recipients.some((x) => x.email === r.email)) {
      setRecipients((prev) => [...prev, r]);
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  const addManualEmail = () => {
    const email = manualEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Correo inválido");
      return;
    }
    addRecipient({ email, name: email, type: "manual" });
    setManualEmail("");
  };

  const addAllTeachers = () => {
    const newRecips = teachers
      .filter((t) => t.email && !recipients.some((r) => r.email === t.email))
      .map((t) => ({
        email: t.email!,
        name: getTeacherName(t),
        type: "teacher" as const,
      }));
    setRecipients((prev) => [...prev, ...newRecips]);
    toast.success(`${newRecips.length} docente(s) agregados`);
  };

  const addAllFamilies = () => {
    const newRecips = familyReps
      .filter((r) => r.email && !recipients.some((x) => x.email === r.email))
      .map((r) => ({
        email: r.email!,
        name: getRepName(r),
        type: "family" as const,
      }));
    setRecipients((prev) => [...prev, ...newRecips]);
    toast.success(`${newRecips.length} familia(s) agregada(s)`);
  };

  const handleSend = async () => {
    if (!recipients.length) return toast.error("Agrega al menos un destinatario");
    if (!subject.trim()) return toast.error("Escribe un asunto");
    if (!body.trim()) return toast.error("Escribe un mensaje");

    setSending(true);
    try {
      const html = buildEmailHtml(
        subject,
        body,
        primaryColor,
        secondaryColor,
        school?.logo_url || null,
        school?.name || "Colegio"
      );
      const emails = recipients.map((r) => r.email);
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: emails, subject, body: html, isHtml: true },
      });
      if (error) throw error;
      toast.success(data?.message || `Email enviado a ${emails.length} destinatario(s)`);
      setRecipients([]);
      setSubject("");
      setBody("");
    } catch (error: any) {
      toast.error(error?.message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  const previewHtml = useMemo(
    () =>
      buildEmailHtml(
        subject || "Asunto del correo",
        body || "Tu mensaje aparecerá aquí...",
        primaryColor,
        secondaryColor,
        school?.logo_url || null,
        school?.name || "Nombre del Colegio"
      ),
    [subject, body, primaryColor, secondaryColor, school]
  );

  const recipientTypeIcon = (type: string) => {
    if (type === "teacher") return <GraduationCap className="h-3 w-3" />;
    if (type === "family") return <Home className="h-3 w-3" />;
    return <Mail className="h-3 w-3" />;
  };

  const recipientTypeColor = (type: string): "default" | "secondary" | "outline" => {
    if (type === "teacher") return "default";
    if (type === "family") return "secondary";
    return "outline";
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* Composer */}
      <div className="space-y-4">
        {/* Recipients */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Destinatarios</Label>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addAllTeachers}
              disabled={!teachers.length}
            >
              <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
              Todos los docentes ({teachers.length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={addAllFamilies}
              disabled={!familyReps.length}
            >
              <Home className="h-3.5 w-3.5 mr-1.5" />
              Todas las familias ({familyReps.length})
            </Button>

            {/* Individual teacher selector */}
            <Popover open={teacherPopoverOpen} onOpenChange={setTeacherPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <GraduationCap className="h-3.5 w-3.5 mr-1.5" />
                  Docente
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <ScrollArea className="max-h-52">
                  {teachers.map((t) => (
                    <button
                      key={t.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                      onClick={() => {
                        addRecipient({
                          email: t.email!,
                          name: getTeacherName(t),
                          type: "teacher",
                        });
                        setTeacherPopoverOpen(false);
                      }}
                    >
                      <div>
                        <p className="font-medium text-xs">{getTeacherName(t)}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                      </div>
                      {recipients.some((r) => r.email === t.email) && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">✓</Badge>
                      )}
                    </button>
                  ))}
                  {!teachers.length && (
                    <p className="text-xs text-muted-foreground p-3">Sin docentes con email</p>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>

            {/* Individual family selector */}
            <Popover open={familyPopoverOpen} onOpenChange={setFamilyPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Home className="h-3.5 w-3.5 mr-1.5" />
                  Familia
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="start">
                <ScrollArea className="max-h-52">
                  {familyReps.map((r) => (
                    <button
                      key={r.id}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center justify-between"
                      onClick={() => {
                        addRecipient({
                          email: r.email!,
                          name: getRepName(r),
                          type: "family",
                        });
                        setFamilyPopoverOpen(false);
                      }}
                    >
                      <div>
                        <p className="font-medium text-xs">{getRepName(r)}</p>
                        <p className="text-xs text-muted-foreground">{r.email}</p>
                      </div>
                      {recipients.some((x) => x.email === r.email) && (
                        <Badge variant="secondary" className="text-[10px] px-1.5">✓</Badge>
                      )}
                    </button>
                  ))}
                  {!familyReps.length && (
                    <p className="text-xs text-muted-foreground p-3">Sin familias con email</p>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          {/* Manual email input */}
          <div className="flex gap-2">
            <Input
              placeholder="correo@ejemplo.com"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManualEmail())}
              className="flex-1"
            />
            <Button variant="outline" size="icon" onClick={addManualEmail}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Recipients chips */}
          {recipients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 bg-muted/50 rounded-lg border min-h-[44px]">
              {recipients.map((r) => (
                <Badge
                  key={r.email}
                  variant={recipientTypeColor(r.type)}
                  className="gap-1 pr-1 text-xs"
                >
                  {recipientTypeIcon(r.type)}
                  <span className="max-w-[160px] truncate">{r.name}</span>
                  <button
                    onClick={() => removeRecipient(r.email)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-background/50 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {recipients.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {recipients.length} destinatario(s) seleccionado(s)
            </p>
          )}
        </div>

        <Separator />

        {/* Subject */}
        <div className="space-y-1.5">
          <Label htmlFor="email-subject" className="text-sm font-medium">Asunto</Label>
          <Input
            id="email-subject"
            placeholder="Asunto del correo"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Body */}
        <div className="space-y-1.5">
          <Label htmlFor="email-body" className="text-sm font-medium">Mensaje</Label>
          <Textarea
            id="email-body"
            placeholder="Escribe tu mensaje aquí..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="resize-y"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleSend}
            disabled={sending || !recipients.length || !subject.trim() || !body.trim()}
            className="flex-1"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {sending ? "Enviando..." : "Enviar Correo"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="xl:hidden"
          >
            <Eye className="h-4 w-4 mr-2" />
            Vista previa
          </Button>
        </div>
      </div>

      {/* Preview - always visible on xl, toggleable on smaller */}
      <div className={`${showPreview ? "block" : "hidden"} xl:block`}>
        <Card className="sticky top-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Vista previa del correo
              </span>
            </div>
            <div className="border rounded-lg overflow-hidden bg-[#f4f4f7]">
              <iframe
                srcDoc={previewHtml}
                className="w-full border-0"
                style={{ height: 480 }}
                title="Vista previa del email"
                sandbox=""
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
