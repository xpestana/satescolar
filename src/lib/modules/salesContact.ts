/** SAT Escolar sales WhatsApp number (international format, digits only). */
export const SALES_WHATSAPP_PHONE = "584120743558";

export function buildWhatsappUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

interface ModuleContactMessageInput {
  moduleName: string;
  schoolName?: string | null;
  expired?: boolean;
}

/** Pre-filled WhatsApp message a school sends to ask for (or renew) a module. */
export function buildModuleContactMessage({ moduleName, schoolName, expired = false }: ModuleContactMessageInput): string {
  const from = schoolName?.trim() ? `, soy de *${schoolName.trim()}*` : "";
  if (expired) {
    return `Hola 👋${from}. Quiero renovar el módulo *${moduleName}* en SAT Escolar. ¿Me ayudan?`;
  }
  return `Hola 👋${from}. Me interesa activar el módulo *${moduleName}* en SAT Escolar. ¿Me pueden dar más información?`;
}
