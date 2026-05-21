import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Baby, BookOpen, GraduationCap, FileText, Settings, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function BolletasFormatTab() {
  const { schoolId } = useSchoolId();

  const { data: config } = useQuery({
    queryKey: ["grades-config", schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase
        .from("grades_config")
        .select("primary_report_type, preschool_report_type, primary_template, preschool_template, secondary_template")
        .eq("school_id", schoolId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!schoolId,
  });

  const primaryType = config?.primary_report_type ?? "descriptive";
  const preschoolType = config?.preschool_report_type ?? "descriptive";

  const reportTypeLabel = (type: string) =>
    type === "indicators" ? "Por Indicadores" : "Descriptiva";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Configura el formato de las boletas de calificaciones por nivel educativo.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {/* ── Preescolar ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Baby className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Preescolar</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">Prematernal, 1er Nivel, 2do Nivel, 3er Nivel</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tipo configurado:</span>
              <Badge variant="secondary">{reportTypeLabel(preschoolType)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              La boleta de Preescolar utiliza el tipo y la plantilla configurados en Ajustes de Notas.
            </p>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/school/configuraciones/ajustes-notas">
                <Settings className="h-4 w-4 mr-1" />
                Configurar en Ajustes de Notas
              </Link>
            </Button>
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              Próximamente: Editor visual para Preescolar
            </div>
          </CardContent>
        </Card>

        {/* ── Primaria ───────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Primaria</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">1° a 6° grado</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tipo configurado:</span>
              <Badge variant="secondary">{reportTypeLabel(primaryType)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              La boleta de Primaria utiliza el tipo y la plantilla configurados en Ajustes de Notas.
            </p>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link to="/school/configuraciones/ajustes-notas">
                <Settings className="h-4 w-4 mr-1" />
                Configurar en Ajustes de Notas
              </Link>
            </Button>
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              Próximamente: Editor visual para Primaria
            </div>
          </CardContent>
        </Card>

        {/* ── Bachillerato ───────────────────────────────────────────────── */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Bachillerato</CardTitle>
            </div>
            <p className="text-xs text-muted-foreground">1° a 5° año (Media General / Técnica) y 6° año</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500 hover:bg-green-600">Disponible</Badge>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">La boleta incluye:</p>
              <ul className="space-y-1.5">
                {[
                  "Encabezado del colegio (logo, nombre, códigos, dirección)",
                  "Nombre del estudiante, año y sección",
                  "Todas las áreas asignadas al año con sus calificaciones",
                  "Definitiva del momento seleccionado",
                  "Posición del estudiante en la sección",
                  "Líneas de firma configuradas",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 border">
              El encabezado y las firmas se configuran en{" "}
              <Link
                to="/school/configuraciones/inscripcion-campos"
                className="text-primary underline underline-offset-2"
              >
                Planillas
              </Link>
              .
            </div>

            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded p-2">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              Descarga disponible en <strong className="ml-0.5">Notas y Boletas → Descarga de Boletas</strong>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
