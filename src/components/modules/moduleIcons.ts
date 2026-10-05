import { BookOpen, ClipboardList, CreditCard, FileText, GraduationCap, Mail, type LucideIcon } from "lucide-react";
import type { SellableModuleKey } from "@/lib/modules/moduleCatalog";

export const MODULE_ICONS: Record<SellableModuleKey, LucideIcon> = {
  messaging: Mail,
  payments: CreditCard,
  grades: GraduationCap,
  ministry_forms: FileText,
  attendance: ClipboardList,
  virtual_classroom: BookOpen,
};
