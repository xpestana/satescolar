import { describe, expect, it } from "vitest";
import { buildWelcomeEmail, CUSTOM_TEMPLATE_BY_ROLE, LOGIN_URL } from "./welcome-email-content";

const base = {
  schoolName: "Colegio Demo",
  logoUrl: null,
  email: "rep@example.com",
  password: "Abc123xyz",
};

const template = {
  subject: "Hola desde {{nombre_colegio}}",
  body_html: "<p>Usuario {{email_usuario}} / clave {{contrasena}} / {{url_plataforma}}</p>",
  primary_color: "#123456",
  text_color: "#ffffff",
};

describe("buildWelcomeEmail", () => {
  it("uses the school's edited SUBJECT as well as the body (create-family/teacher ignored it)", () => {
    const { subject, html } = buildWelcomeEmail({ ...base, role: "representante", customTemplate: template });
    expect(subject).toBe("Hola desde Colegio Demo");
    expect(html).toContain("Usuario rep@example.com / clave Abc123xyz / " + LOGIN_URL);
    expect(html).toContain("#123456");
  });

  it("falls back to the default welcome when the school has no template", () => {
    const { subject, html } = buildWelcomeEmail({ ...base, role: "docente" });
    expect(subject).toBe("Bienvenido a Colegio Demo - SAT Escolar");
    expect(html).toContain("<strong>docente</strong>");
    expect(html).toContain("Abc123xyz");
  });

  it("uses the given default subject only when there is no template", () => {
    expect(
      buildWelcomeEmail({ ...base, role: "usuario del colegio", defaultSubject: "Nuevas credenciales - Colegio Demo" })
        .subject,
    ).toBe("Nuevas credenciales - Colegio Demo");
    expect(
      buildWelcomeEmail({ ...base, role: "representante", customTemplate: template, defaultSubject: "x" }).subject,
    ).toBe("Hola desde Colegio Demo");
  });

  it("only families and teachers have an editable template", () => {
    expect(CUSTOM_TEMPLATE_BY_ROLE).toEqual({ docente: "welcome-teacher", representante: "welcome-family" });
  });
});
