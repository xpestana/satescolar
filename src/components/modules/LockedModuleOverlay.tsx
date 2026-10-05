import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MODULE_CATALOG, type SellableModuleKey } from "@/lib/modules/moduleCatalog";
import { buildModuleContactMessage, buildWhatsappUrl, SALES_WHATSAPP_PHONE } from "@/lib/modules/salesContact";
import { MODULE_ICONS } from "./moduleIcons";

interface LockedModuleOverlayProps {
  module: SellableModuleKey;
  schoolName?: string | null;
  /** ISO date the module expired on; when set, the copy invites to renew. */
  expiredAt?: string | null;
}

export function LockedModuleOverlay({ module, schoolName, expiredAt }: LockedModuleOverlayProps) {
  const info = MODULE_CATALOG[module];
  const Icon = MODULE_ICONS[module];
  const expired = !!expiredAt;
  const whatsappUrl = buildWhatsappUrl(
    SALES_WHATSAPP_PHONE,
    buildModuleContactMessage({ moduleName: info.name, schoolName, expired }),
  );

  return (
    <Card className="w-full max-w-lg border-primary/20 shadow-2xl">
      <CardContent className="space-y-5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background shadow">
              <Lock className="h-3 w-3 text-muted-foreground" />
            </span>
          </div>
          <h2 className="text-lg font-bold leading-snug sm:text-xl">
            {expired
              ? `Tu módulo ${info.name} venció el ${format(new Date(expiredAt), "d 'de' MMMM", { locale: es })}`
              : `✨ Lleva tu colegio al siguiente nivel con ${info.name}`}
          </h2>
        </div>

        <p className="text-muted-foreground">
          {expired ? (
            "Renuévalo para seguir disfrutándolo 🙌. Escríbenos y lo reactivamos de inmediato, sin perder nada de tu información."
          ) : (
            <>
              <span className="font-medium text-foreground">{info.tagline}</span> Este módulo aún no está
              activo en tu colegio. Escríbenos y te lo activamos hoy mismo: te mostramos cómo funciona, sin
              compromiso.
            </>
          )}
        </p>

        <ul className="space-y-2">
          {info.benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        <Button asChild size="lg" className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]">
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="mr-2 h-5 w-5" />
            {expired ? "Renovar por WhatsApp" : "Quiero este módulo, hablemos por WhatsApp"}
          </a>
        </Button>
        <p className="text-center text-xs text-muted-foreground">Atención personalizada del equipo de SAT Escolar.</p>
      </CardContent>
    </Card>
  );
}
