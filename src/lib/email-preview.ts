/**
 * Preview of a school email template in the editor. It uses the SAME render, layout and sample
 * data as the Edge Functions (supabase/functions/_shared/email), so what the school sees is what
 * goes out.
 */
import { renderEmailTemplate } from "../../supabase/functions/_shared/email/render.ts";
import { EMAIL_TEMPLATES, isEmailTemplateType } from "../../supabase/functions/_shared/email/templates.ts";

export function buildEmailPreviewHtml(
  templateType: string,
  bodyHtml: string,
  primaryColor: string,
  textColor: string,
  schoolName: string,
  schoolLogoUrl: string | null,
): string {
  if (!isEmailTemplateType(templateType)) return "";
  const sample = { ...EMAIL_TEMPLATES[templateType].sample, nombre_colegio: schoolName };
  return renderEmailTemplate(
    templateType,
    { subject: "", body_html: bodyHtml, primary_color: primaryColor, text_color: textColor },
    sample,
    { name: schoolName, logoUrl: schoolLogoUrl },
  ).html;
}
