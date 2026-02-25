import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { useSchoolData } from "@/hooks/useSchoolData";
import { useCarnetConfig } from "@/hooks/useCarnetConfig";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
    const bodyHtml = message.replace(/\n/g, "<br/>");

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

<!-- Header -->
<tr><td style="background-color:${primaryColor};padding:32px 40px;text-align:center;">
${logoUrl ? `<img src="${logoUrl}" alt="${schoolName}" style="height:60px;margin-bottom:12px;border-radius:8px;" />` : ""}
<h2 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;letter-spacing:0.5px;">${schoolName}</h2>
</td></tr>

<!-- Accent bar -->
<tr><td style="background-color:${secondaryColor};height:4px;"></td></tr>

<!-- Subject -->
<tr><td style="padding:32px 40px 0;">
<h1 style="color:${primaryColor};margin:0;font-size:24px;font-weight:700;line-height:1.3;">${subject || "Asunto del correo"}</h1>
</td></tr>

<!-- Body -->
<tr><td style="padding:20px 40px 32px;">
<div style="color:#374151;font-size:15px;line-height:1.7;">
${bodyHtml || '<span style="color:#9ca3af;">El contenido de tu mensaje aparecerá aquí...</span>'}
</div>
</td></tr>

<!-- Divider -->
<tr><td style="padding:0 40px;">
<hr style="border:none;border-top:2px solid ${secondaryColor};opacity:0.3;margin:0;" />
</td></tr>

<!-- Footer -->
<tr><td style="background-color:${primaryColor};padding:24px 40px;text-align:center;border-radius:0 0 12px 12px;">
<p style="color:rgba(255,255,255,0.7);margin:0;font-size:12px;">Desarrollado por <a href="https://satescolar.com" style="color:${secondaryColor};text-decoration:none;font-weight:600;">SATEscolar</a></p>
<p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:11px;">satescolar.com</p>
</td></tr>

</table>
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
    try {
      const emails = recipients.map((r) => r.email);
      const html = buildEmailHtml();

      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: emails, subject, body: html, isHtml: true },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Correo enviado a ${emails.length} destinatario(s)`);
      setRecipients([]);
      setSubject("");
      setMessage("");
    } catch (e: any) {
      toast.error(e.message || "Error al enviar");
    } finally {
      setSending(false);
    }
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

            {/* Message body */}
            <Textarea
              placeholder="Escribe tu mensaje aquí..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={10}
              className="resize-none"
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
              <span className="text-sm font-medium text-muted-foreground">Vista Previa</span>
            </div>
            <div
              className="border rounded-lg overflow-hidden bg-[#f4f4f7]"
              style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto" }}
            >
              <div
                className="transform origin-top scale-[0.55] xl:scale-[0.65]"
                style={{ width: "600px", margin: "0 auto" }}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
