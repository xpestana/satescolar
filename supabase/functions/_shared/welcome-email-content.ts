import { buildWelcomeEmailHtml, resolveSnippets, wrapWithEmailLayout } from "./email-templates.ts";

export const LOGIN_URL = "https://app.satescolar.com/login";

export type WelcomeRole = "representante" | "docente" | "administrador" | "usuario del colegio";

/** Roles whose welcome text the school can edit in "Templates de Correo". */
export const CUSTOM_TEMPLATE_BY_ROLE: Partial<Record<WelcomeRole, string>> = {
  docente: "welcome-teacher",
  representante: "welcome-family",
};

export interface CustomEmailTemplate {
  subject: string;
  body_html: string;
  primary_color: string;
  text_color: string;
}

export interface WelcomeEmailInput {
  schoolName: string;
  logoUrl: string | null;
  email: string;
  password: string;
  role: WelcomeRole;
  /** The school's active template for this role, if it customized one. */
  customTemplate?: CustomEmailTemplate | null;
  /** Subject used when there is no custom template (defaults to the welcome subject). */
  defaultSubject?: string;
  loginUrl?: string;
}

/** Subject and HTML of the welcome email: the school's template (subject included) or the default. */
export function buildWelcomeEmail(input: WelcomeEmailInput): { subject: string; html: string } {
  const loginUrl = input.loginUrl ?? LOGIN_URL;
  const custom = input.customTemplate;

  if (custom) {
    const snippets: Record<string, string> = {
      nombre_colegio: input.schoolName,
      email_usuario: input.email,
      contrasena: input.password,
      url_plataforma: loginUrl,
      primary_color: custom.primary_color,
    };
    return {
      subject: resolveSnippets(custom.subject, snippets),
      html: wrapWithEmailLayout(
        resolveSnippets(custom.body_html, snippets),
        custom.primary_color,
        custom.text_color,
        input.schoolName,
        input.logoUrl,
      ),
    };
  }

  return {
    subject: input.defaultSubject ?? `Bienvenido a ${input.schoolName} - SAT Escolar`,
    html: buildWelcomeEmailHtml(input.schoolName, input.logoUrl, input.email, input.password, input.role, loginUrl),
  };
}
