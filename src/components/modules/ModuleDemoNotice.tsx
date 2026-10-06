import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSchoolData } from "@/hooks/useSchoolData";
import { MODULE_CATALOG, type SellableModuleKey } from "@/lib/modules/moduleCatalog";
import { buildModuleContactMessage, buildWhatsappUrl, SALES_WHATSAPP_PHONE } from "@/lib/modules/salesContact";

interface ModuleDemoNoticeProps {
  /** Module pitched in the pre-filled WhatsApp message. */
  module: SellableModuleKey;
  /** Short link text; keep it to a few words. */
  label?: string;
  className?: string;
}

/**
 * Marks a block that shows sample data because the school lacks `module`, with a short text
 * link to sales on WhatsApp (see docs/desc/19-modulos.md).
 */
export function ModuleDemoNotice({ module, label = "Desbloquéalo por WhatsApp", className }: ModuleDemoNoticeProps) {
  const { school } = useSchoolData();
  const href = buildWhatsappUrl(
    SALES_WHATSAPP_PHONE,
    buildModuleContactMessage({ moduleName: MODULE_CATALOG[module].name, schoolName: school?.name }),
  );

  return (
    <p className={cn("flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-xs", className)}>
      <span className="rounded-full bg-foreground/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Ejemplo
      </span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-0.5 font-medium text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400"
      >
        {label}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </a>
    </p>
  );
}
