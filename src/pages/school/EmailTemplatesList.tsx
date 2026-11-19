import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MailCheck, ChevronRight, Users, GraduationCap, AlertCircle, CreditCard, UserCog, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchoolId } from "@/hooks/useSchoolId";
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_TYPES,
  type EmailTemplateType,
} from "../../../supabase/functions/_shared/email/templates.ts";

const ICONS: Record<EmailTemplateType, LucideIcon> = {
  "welcome-family": Users,
  "welcome-teacher": GraduationCap,
  "welcome-staff": UserCog,
  delinquency: AlertCircle,
  "payment-reminder": CreditCard,
};

// Same catalog the Edge Functions send with (supabase/functions/_shared/email/templates.ts).
const TEMPLATE_TYPES = EMAIL_TEMPLATE_TYPES.map((id) => ({
  id,
  label: EMAIL_TEMPLATES[id].label,
  description: EMAIL_TEMPLATES[id].description,
  comingSoon: !EMAIL_TEMPLATES[id].sendsAutomatically,
  icon: ICONS[id],
}));

export default function EmailTemplatesList() {
  const navigate = useNavigate();
  const { schoolId } = useSchoolId();

  const { data: templates } = useQuery({
    queryKey: ["email-templates", schoolId],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_templates")
        .select("template_type")
        .eq("school_id", schoolId!)
        .eq("is_active", true);
      return data ?? [];
    },
    enabled: !!schoolId,
  });

  const customizedTypes = new Set((templates ?? []).map((t) => t.template_type));

  return (
    <DashboardLayout>
      <PageHeader
        title="Templates de Correo"
        breadcrumbs={[{ label: "Ajustes" }, { label: "Templates de Correo" }]}
      />

      <div className="max-w-2xl space-y-3">
        {TEMPLATE_TYPES.map((type) => {
          const Icon = type.icon;
          const isCustom = customizedTypes.has(type.id);
          return (
            <Card
              key={type.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/school/configuraciones/correos/${type.id}`)}
            >
              <CardContent className="p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
                    <span className="font-semibold text-sm">{type.label}</span>
                    <Badge variant={isCustom ? "default" : "secondary"} className="text-xs whitespace-nowrap">
                      {isCustom ? "Personalizado" : "Por defecto"}
                    </Badge>
                    {type.comingSoon && (
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        Próximamente
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{type.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          );
        })}

        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          <MailCheck className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
          <span>Los templates "Por defecto" usan el diseño estándar de SAT Escolar. Al personalizar, el colegio puede definir colores, textos y snippets de datos propios.</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
