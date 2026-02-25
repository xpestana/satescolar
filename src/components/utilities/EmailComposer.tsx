import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { useCarnetConfig } from "@/hooks/useCarnetConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/utilities/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import {
  Send,
  X,
  Users,
  GraduationCap,
  Plus,
  ChevronDown,
  Loader2,
  Mail,
  Eye,
} from "lucide-react";

interface Recipient {
  email: string;
  name: string;
  type: "teacher" | "family" | "manual" | "group";
}

export function EmailComposer() {
  const { schoolId } = useSchoolId();
  const { school } = useSchoolData();
  const { data: carnetConfig } = useCarnetConfig(schoolId);
  const queryClient = useQueryClient();

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);

  const primaryColor = carnetConfig?.primary_color || "#01051e";
  const secondaryColor = carnetConfig?.secondary_color || "#1e78c8";

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

  // Fetch families (primary representatives)
  const { data: families = [] } = useQuery({
    queryKey: ["email-families", schoolId],
    queryFn: async () => {
      const { data: familySchools, error: fsError } = await supabase
        .from("family_schools")
        .select("family_id")
        .eq("school_id", schoolId!);
      if (fsError) throw fsError;
      const familyIds = (familySchools || []).map((fs) => fs.family_id);
      if (familyIds.length === 0) return [];

      const { data: reps, error: repError } = await supabase
        .from("representatives")
        .select("id, email, form_data, family_id")
        .in("family_id", familyIds)
        .eq("is_primary", true);
      if (repError) throw repError;
      return (reps || []).filter((r) => r.email);
    },
    enabled: !!schoolId,
  });

  const getTeacherName = (t: any) => {
    const fd = t.form_data as Record<string, any> | null;
    if (!fd) return t.email;
    return [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ") || t.email;
  };

  const getFamilyName = (r: any) => {
    const fd = r.form_data as Record<string, any> | null;
    if (!fd) return r.email;
    return [fd.primer_nombre, fd.primer_apellido].filter(Boolean).join(" ") || r.email;
  };

  const addRecipient = (r: Recipient) => {
    if (!recipients.some((x) => x.email === r.email)) {
      setRecipients((prev) => [...prev, r]);
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  };

  const addAllTeachers = () => {
    const newOnes = teachers
      .filter((t) => !recipients.some((r) => r.email === t.email))
      .map((t) => ({ email: t.email!, name: getTeacherName(t), type: "teacher" as const }));
    setRecipients((prev) => [...prev, ...newOnes]);
  };

  const addAllFamilies = () => {
    const newOnes = families
      .filter((f) => !recipients.some((r) => r.email === f.email))
      .map((f) => ({ email: f.email!, name: getFamilyName(f), type: "family" as const }));
    setRecipients((prev) => [...prev, ...newOnes]);
  };

  const addManualEmail = () => {
    const trimmed = manualEmail.trim();
    if (trimmed && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      addRecipient({ email: trimmed, name: trimmed, type: "manual" });
      setManualEmail("");
    } else {
      toast.error("Correo inválido");
    }
  };

  const buildEmailHtml = () => {
    const logoUrl = school?.logo_url || "";
    const schoolName = school?.name || "Colegio";
    const bodyHtml = message; // Already HTML from rich text editor
    const subjectText = subject || "Asunto del correo";
    const bodyContent = bodyHtml || '<span style="color:#9ca3af;font-style:italic;">El contenido de tu mensaje aparecerá aquí...</span>';

    return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<!-- Outer wrapper -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;">
<tr><td align="center" style="padding:40px 20px;">

<!-- Main card -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

<!-- Top accent line -->
<tr><td style="background:linear-gradient(90deg,${primaryColor},${secondaryColor});height:4px;font-size:0;line-height:0;">&nbsp;</td></tr>

<!-- Header with logo -->
<tr><td style="background-color:${primaryColor};padding:28px 40px;text-align:center;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      ${logoUrl ? `<img src="${logoUrl}" alt="${schoolName}" style="height:52px;margin-bottom:14px;border-radius:6px;display:block;margin-left:auto;margin-right:auto;" />` : ""}
      <p style="color:#ffffff;margin:0;font-size:18px;font-weight:600;letter-spacing:0.3px;line-height:1.4;">${schoolName}</p>
    </td></tr>
  </table>
</td></tr>

<!-- Secondary accent bar -->
<tr><td style="background-color:${secondaryColor};height:3px;font-size:0;line-height:0;">&nbsp;</td></tr>

<!-- Content area -->
<tr><td style="padding:36px 40px 16px;">
  <h1 style="color:#1a1a2e;margin:0 0 8px;font-size:22px;font-weight:700;line-height:1.35;">${subjectText}</h1>
  <div style="width:48px;height:3px;background-color:${secondaryColor};border-radius:2px;margin-bottom:24px;"></div>
</td></tr>

<tr><td style="padding:0 40px 36px;">
  <div style="color:#4a4a68;font-size:15px;line-height:1.75;">${bodyContent}</div>
</td></tr>

<!-- Divider -->
<tr><td style="padding:0 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="border-top:1px solid #e8e8ef;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>
</td></tr>

<!-- School info footer -->
<tr><td style="padding:24px 40px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="vertical-align:middle;">
        ${logoUrl ? `<img src="${logoUrl}" alt="" style="height:28px;border-radius:4px;display:inline-block;vertical-align:middle;margin-right:10px;" />` : ""}
        <span style="color:#6b7280;font-size:13px;vertical-align:middle;">${schoolName}</span>
      </td>
    </tr>
  </table>
</td></tr>

<!-- Bottom footer -->
<tr><td style="background-color:${primaryColor};padding:20px 40px;text-align:center;">
  <p style="color:rgba(255,255,255,0.6);margin:0;font-size:12px;line-height:1.5;">
    Desarrollado por <a href="https://satescolar.com" style="color:${secondaryColor};text-decoration:none;font-weight:600;">SATEscolar</a>
  </p>
  <p style="color:rgba(255,255,255,0.4);margin:6px 0 0;font-size:11px;">
    <a href="https://satescolar.com" style="color:rgba(255,255,255,0.4);text-decoration:none;">satescolar.com</a>
  </p>
</td></tr>

</table>
<!-- End main card -->

</td></tr>
</table>

</body>
</html>`;
  };

  const handleSend = async () => {
    if (recipients.length === 0) return toast.error("Agrega al menos un destinatario");
    if (!subject.trim()) return toast.error("Agrega un asunto");
    if (!message.trim()) return toast.error("Escribe un mensaje");

    setSending(true);
    const emails = recipients.map((r) => r.email);
    const html = buildEmailHtml();
    let status = "success";
    let errorMessage: string | null = null;

    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: emails, subject, body: html, isHtml: true },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Correo enviado a ${emails.length} destinatario(s)`);
    } catch (e: any) {
      status = "error";
      errorMessage = e.message || "Error al enviar";
      toast.error(errorMessage);
    }

    // Save to history regardless of success/failure
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("email_history").insert({
        school_id: schoolId!,
        sent_by: user!.id,
        recipients: recipients as any,
        subject,
        body_html: html,
        status,
        error_message: errorMessage,
        recipient_count: emails.length,
      });
      queryClient.invalidateQueries({ queryKey: ["email-history"] });
    } catch {
      // Silent fail for history save
    }

    if (status === "success") {
      setRecipients([]);
      setSubject("");
      setMessage("");
    }

    setSending(false);
  };

  const previewHtml = useMemo(() => buildEmailHtml(), [subject, message, school, primaryColor, secondaryColor]);

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "teacher": return "bg-blue-100 text-blue-800 border-blue-200";
      case "family": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Compose Panel */}
      <div className="xl:col-span-3 space-y-4">
        <Card className="border shadow-sm">
          <CardContent className="p-6 space-y-5">
            {/* Quick actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={addAllTeachers}
                className="gap-2"
                disabled={teachers.length === 0}
              >
                <GraduationCap className="h-4 w-4" />
                Todos los Docentes ({teachers.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addAllFamilies}
                className="gap-2"
                disabled={families.length === 0}
              >
                <Users className="h-4 w-4" />
                Todas las Familias ({families.length})
              </Button>

              {/* Individual teacher */}
              <Popover open={teacherOpen} onOpenChange={setTeacherOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <GraduationCap className="h-4 w-4" /> Docente <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-72" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar docente..." />
                    <CommandList>
                      <CommandEmpty>Sin resultados</CommandEmpty>
                      <CommandGroup>
                        {teachers.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={`${getTeacherName(t)} ${t.email}`}
                            onSelect={() => {
                              addRecipient({ email: t.email!, name: getTeacherName(t), type: "teacher" });
                              setTeacherOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{getTeacherName(t)}</span>
                              <span className="text-xs text-muted-foreground">{t.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Individual family */}
              <Popover open={familyOpen} onOpenChange={setFamilyOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Users className="h-4 w-4" /> Familia <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-72" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar familia..." />
                    <CommandList>
                      <CommandEmpty>Sin resultados</CommandEmpty>
                      <CommandGroup>
                        {families.map((f) => (
                          <CommandItem
                            key={f.id}
                            value={`${getFamilyName(f)} ${f.email}`}
                            onSelect={() => {
                              addRecipient({ email: f.email!, name: getFamilyName(f), type: "family" });
                              setFamilyOpen(false);
                            }}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{getFamilyName(f)}</span>
                              <span className="text-xs text-muted-foreground">{f.email}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Manual email input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Agregar correo manualmente..."
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManualEmail()}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="icon" onClick={addManualEmail}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Recipients chips */}
            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-3 bg-muted/50 rounded-lg border max-h-32 overflow-y-auto">
                {recipients.map((r) => (
                  <span
                    key={r.email}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${getBadgeColor(r.type)}`}
                  >
                    {r.name !== r.email ? `${r.name} (${r.email})` : r.email}
                    <button
                      onClick={() => removeRecipient(r.email)}
                      className="ml-0.5 hover:opacity-70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {recipients.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {recipients.length} destinatario(s) seleccionado(s)
              </p>
            )}

            {/* Subject */}
            <Input
              placeholder="Asunto del correo"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-base font-medium"
            />

            {/* Message body - Rich Text Editor */}
            <RichTextEditor
              value={message}
              onChange={setMessage}
              placeholder="Escribe tu mensaje aquí..."
              minHeight={250}
            />

            {/* Send button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSend}
                disabled={sending || recipients.length === 0 || !subject.trim() || !message.trim()}
                className="gap-2 px-6"
                size="lg"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Enviando..." : "Enviar Correo"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Panel */}
      <div className="xl:col-span-2">
        <Card className="border shadow-sm sticky top-20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Vista Previa del Correo</span>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <iframe
                srcDoc={previewHtml}
                title="Email preview"
                className="w-full border-0"
                style={{ height: "520px", background: "#f0f2f5" }}
                sandbox=""
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
