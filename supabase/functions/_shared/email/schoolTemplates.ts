import { defaultTemplate, renderEmailTemplate, type RenderedEmail, type StoredEmailTemplate } from "./render.ts";
import type { EmailTemplateType } from "./templates.ts";

/** Minimal query surface used here (a SupabaseClient satisfies it). */
export interface TemplateReader {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- any Supabase query builder
  from(table: string): any;
}

export interface SchoolBranding {
  name: string;
  logoUrl: string | null;
  phone: string | null;
  email: string | null;
}

export async function loadSchoolBranding(client: TemplateReader, schoolId: string | null): Promise<SchoolBranding> {
  if (!schoolId) return { name: "SAT Escolar", logoUrl: null, phone: null, email: null };
  const { data } = await client.from("schools").select("name, logo_url, phone, email").eq("id", schoolId).maybeSingle();
  return {
    name: data?.name ?? "SAT Escolar",
    logoUrl: data?.logo_url ?? null,
    phone: data?.phone ?? null,
    email: data?.email ?? null,
  };
}

/** The school's active template of `type`, or the catalog default. */
export async function loadEmailTemplate(
  client: TemplateReader,
  schoolId: string | null,
  type: EmailTemplateType,
): Promise<{ template: StoredEmailTemplate; isCustom: boolean }> {
  if (schoolId) {
    const { data } = await client
      .from("email_templates")
      .select("subject, body_html, primary_color, text_color")
      .eq("school_id", schoolId)
      .eq("template_type", type)
      .eq("is_active", true)
      .maybeSingle();
    if (data) return { template: data as StoredEmailTemplate, isCustom: true };
  }
  return { template: defaultTemplate(type), isCustom: false };
}

/** Loads branding + template and renders it: what every school email uses. */
export async function renderSchoolEmail(
  client: TemplateReader,
  schoolId: string | null,
  type: EmailTemplateType,
  vars: Record<string, string>,
  preloaded?: { branding?: SchoolBranding; template?: StoredEmailTemplate },
): Promise<RenderedEmail> {
  const branding = preloaded?.branding ?? (await loadSchoolBranding(client, schoolId));
  const template = preloaded?.template ?? (await loadEmailTemplate(client, schoolId, type)).template;
  return renderEmailTemplate(type, template, { nombre_colegio: branding.name, ...vars }, {
    name: branding.name,
    logoUrl: branding.logoUrl,
  });
}
