import { LOGIN_URL, type EmailTemplateType } from "./templates.ts";

export type WelcomeRole = "representante" | "docente" | "administrador" | "usuario del colegio";

/** Every role has an editable template; school staff (owner and sub-users) share one. */
export const WELCOME_TEMPLATE_BY_ROLE: Record<WelcomeRole, EmailTemplateType> = {
  representante: "welcome-family",
  docente: "welcome-teacher",
  administrador: "welcome-staff",
  "usuario del colegio": "welcome-staff",
};

export interface WelcomeVariablesInput {
  email: string;
  password: string;
  role: WelcomeRole;
  fullName?: string | null;
}

export function buildWelcomeVariables(input: WelcomeVariablesInput): Record<string, string> {
  return {
    email_usuario: input.email,
    contrasena: input.password,
    url_plataforma: LOGIN_URL,
    nombre_usuario: input.fullName?.trim() || input.email,
    rol_usuario: input.role,
  };
}
