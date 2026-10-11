import { useEffect, useState } from "react";
import { ChevronDown, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { usePlanillasConfig } from "@/hooks/usePlanillasConfig";
import { type GradeCertificateSchoolConfig, toCertificateText } from "@/lib/grade-certificate";
import { CertificateTextInput } from "./CertificateTextInput";

const FIELDS: Array<{ key: keyof GradeCertificateSchoolConfig; label: string; placeholder: string }> = [
  { key: "cdcee", label: "CDCEE", placeholder: "Ej. MONAGAS" },
  { key: "issue_place", label: "Lugar de expedición", placeholder: "Ej. MONAGAS" },
  { key: "cdcee_director_name", label: "Director(a) del CDCEE", placeholder: "Apellidos y nombres" },
  { key: "cdcee_director_document", label: "Cédula del director(a) del CDCEE", placeholder: "Ej. V 10.000.000" },
];

/**
 * Datos de la certificación that are the same for every student. They are saved once per school
 * and only this planilla uses them; Planillas → Datos comunes stays untouched.
 */
export function CertificateSchoolSettings() {
  const { gradeCertificateConfig, schoolHeader, saveGradeCertificateConfig, isLoading } = usePlanillasConfig();
  const [form, setForm] = useState(gradeCertificateConfig);
  const [open, setOpen] = useState(false);

  useEffect(() => { setForm(gradeCertificateConfig); }, [gradeCertificateConfig]);

  // CDCEE and place of issue fall back to the entidad federal of Datos comunes when left empty.
  const fallback = toCertificateText(schoolHeader.entidad_federal);
  const summary = [
    `CDCEE: ${gradeCertificateConfig.cdcee || fallback || "sin definir"}`,
    `Expedición: ${gradeCertificateConfig.issue_place || fallback || "sin definir"}`,
  ].join(" · ");

  const isDirty = FIELDS.some(({ key }) => form[key] !== gradeCertificateConfig[key]);

  const handleSave = () =>
    saveGradeCertificateConfig.mutate(form, {
      onSuccess: () => toast.success("Datos de la certificación guardados"),
      onError: (e: Error) => toast.error(e.message || "Error al guardar"),
    });

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Datos de la certificación
                </CardTitle>
                <CardDescription className="truncate">
                  {isLoading ? "Cargando…" : `Se llenan una vez para todo el colegio. ${summary}`}
                </CardDescription>
              </div>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`certificate-${key}`}>{label}</Label>
                  <CertificateTextInput
                    id={`certificate-${key}`}
                    value={form[key]}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, [key]: value }))}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Si dejas vacío el CDCEE o el lugar de expedición se usa la entidad federal de Datos comunes
              {fallback ? ` (${fallback})` : ""}. Estos datos solo aplican a la Certificación de Notas.
            </p>
            <Button onClick={handleSave} disabled={!isDirty || saveGradeCertificateConfig.isPending}>
              {saveGradeCertificateConfig.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
