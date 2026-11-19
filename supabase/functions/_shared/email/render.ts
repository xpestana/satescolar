import { escapeHtml, safeColor, wrapWithEmailLayout } from "./layout.ts";
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_TEXT_COLOR,
  EMAIL_TEMPLATES,
  type EmailTemplateType,
} from "./templates.ts";

/** A school's stored template (`email_templates` row) or the catalog default. */
export interface StoredEmailTemplate {
  subject: string;
  body_html: string;
  primary_color: string | null;
  text_color: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
}

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/** The catalog default, shaped like a stored template. */
export function defaultTemplate(type: EmailTemplateType): StoredEmailTemplate {
  const def = EMAIL_TEMPLATES[type];
  return {
    subject: def.subject,
    body_html: def.body,
    primary_color: DEFAULT_PRIMARY_COLOR,
    text_color: DEFAULT_TEXT_COLOR,
  };
}

/**
 * Replaces `{{key}}` placeholders. Values are HTML-escaped except the keys in `htmlKeys`;
 * unknown keys stay as written so the school can spot a typo in the preview.
 */
export function fillPlaceholders(
  text: string,
  vars: Record<string, string>,
  opts: { escape: boolean; htmlKeys?: Set<string> },
): string {
  return text.replace(PLACEHOLDER, (match, key: string) => {
    if (!(key in vars)) return match;
    const value = vars[key] ?? "";
    return opts.escape && !opts.htmlKeys?.has(key) ? escapeHtml(value) : value;
  });
}

/**
 * Renders a template of `type` with the school's branding: subject (plain text, one line) and the
 * full HTML inside the standard layout. `{{primary_color}}` is always available.
 */
export function renderEmailTemplate(
  type: EmailTemplateType,
  template: StoredEmailTemplate,
  vars: Record<string, string>,
  school: { name: string; logoUrl: string | null },
): RenderedEmail {
  const primaryColor = safeColor(template.primary_color, DEFAULT_PRIMARY_COLOR);
  const textColor = safeColor(template.text_color, DEFAULT_TEXT_COLOR);
  const allVars = { ...vars, primary_color: primaryColor };
  const htmlKeys = new Set(EMAIL_TEMPLATES[type].variables.filter((v) => v.html).map((v) => v.key));

  const subject = fillPlaceholders(template.subject, allVars, { escape: false })
    .replace(/[\r\n]+/g, " ")
    .trim();
  const body = fillPlaceholders(template.body_html, allVars, { escape: true, htmlKeys });

  return {
    subject,
    html: wrapWithEmailLayout(body, { primaryColor, textColor, schoolName: school.name, logoUrl: school.logoUrl }),
  };
}
