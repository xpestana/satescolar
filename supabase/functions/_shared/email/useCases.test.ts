import { describe, expect, it } from "vitest";
import { buildAttendanceEmail } from "./attendance";
import { buildDelinquencyVariables, collectFamilyEmails, formatVes } from "./delinquency";
import { loadEmailTemplate, renderSchoolEmail, type TemplateReader } from "./schoolTemplates";
import { LOGIN_URL } from "./templates";
import { buildWelcomeVariables, WELCOME_TEMPLATE_BY_ROLE } from "./welcome";

/** Fake Supabase client: answers `.from(table)...maybeSingle()` with the row given per table. */
function fakeClient(rows: Record<string, unknown>): TemplateReader {
  const chain = (table: string) => {
    const q = {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
    };
    return q;
  };
  return { from: chain };
}

describe("welcome", () => {
  it("maps every role to an editable template (staff shares one)", () => {
    expect(WELCOME_TEMPLATE_BY_ROLE).toEqual({
      representante: "welcome-family",
      docente: "welcome-teacher",
      administrador: "welcome-staff",
      "usuario del colegio": "welcome-staff",
    });
  });

  it("builds the variables, using the email when there is no name", () => {
    expect(buildWelcomeVariables({ email: "a@example.com", password: "X1", role: "administrador" })).toEqual({
      email_usuario: "a@example.com",
      contrasena: "X1",
      url_plataforma: LOGIN_URL,
      nombre_usuario: "a@example.com",
      rol_usuario: "administrador",
    });
    expect(
      buildWelcomeVariables({ email: "a@example.com", password: "X1", role: "docente", fullName: " Ana " }).nombre_usuario,
    ).toBe("Ana");
  });
});

describe("delinquency", () => {
  it("formats VES with two decimals", () => {
    expect(formatVes(1500)).toMatch(/^1\.?500,00 VES$/);
  });

  it("builds the variables with escaped concept names", () => {
    const vars = buildDelinquencyVariables({
      studentName: "Carlos",
      gradeName: "5to Grado",
      sectionName: "A",
      concepts: [{ name: "Cuota <Enero>", balance: 150 }],
      total: 150,
      schoolPhone: null,
      schoolEmail: "c@example.com",
    });
    expect(vars.grado_seccion).toBe("5to Grado - A");
    expect(vars.conceptos_pendientes).toBe("<ul><li>Cuota &lt;Enero&gt;: <strong>150,00 VES</strong></li></ul>");
    expect(vars.telefono_colegio).toBe("");
    expect(vars.total_adeudado).toBe("150,00 VES");
  });

  it("leaves grade empty when the student has no section", () => {
    expect(
      buildDelinquencyVariables({
        studentName: "x",
        gradeName: "",
        sectionName: "",
        concepts: [],
        total: 0,
        schoolPhone: null,
        schoolEmail: null,
      }).grado_seccion,
    ).toBe("");
  });

  it("writes to the family account AND its representatives, without duplicates", () => {
    expect(
      collectFamilyEmails("Cuenta@Example.com", [
        { email: "cuenta@example.com", form_data: null },
        { email: null, form_data: { correo_electronico: "mama@example.com" } },
        { email: "papa@example.com", form_data: { correo_electronico: "PAPA@example.com" } },
        { email: "sin-arroba", form_data: null },
      ]),
    ).toEqual(["cuenta@example.com", "mama@example.com", "papa@example.com"]);
  });

  it("still works without an account email", () => {
    expect(collectFamilyEmails(null, [{ email: "r@example.com", form_data: null }])).toEqual(["r@example.com"]);
    expect(collectFamilyEmails(null, [])).toEqual([]);
  });
});

describe("attendance", () => {
  it("escapes the person name", () => {
    const { subject, html } = buildAttendanceEmail({
      schoolName: "Colegio",
      logoUrl: null,
      personName: "<img src=x>",
      roleLabel: "Estudiante",
      dateLabel: "19 de noviembre de 2026",
      timeLabel: "07:30",
    });
    expect(subject).toBe("Asistencia registrada - <img src=x>");
    expect(html).toContain("&lt;img src=x&gt;");
    expect(html).not.toContain("<img src=x>");
  });
});

describe("schoolTemplates", () => {
  it("uses the school's custom template when it exists", async () => {
    const client = fakeClient({
      email_templates: { subject: "Propio {{nombre_colegio}}", body_html: "<p>Hola</p>", primary_color: "#222222", text_color: "#ffffff" },
      schools: { name: "Colegio Demo", logo_url: null, phone: null, email: null },
    });
    await expect(loadEmailTemplate(client, "s1", "welcome-family")).resolves.toMatchObject({ isCustom: true });
    const { subject, html } = await renderSchoolEmail(client, "s1", "welcome-family", {});
    expect(subject).toBe("Propio Colegio Demo");
    expect(html).toContain("<p>Hola</p>");
  });

  it("falls back to the catalog default", async () => {
    const client = fakeClient({ schools: { name: "Colegio Demo", logo_url: null } });
    const loaded = await loadEmailTemplate(client, "s1", "welcome-staff");
    expect(loaded.isCustom).toBe(false);
    const { subject } = await renderSchoolEmail(client, "s1", "welcome-staff", { nombre_usuario: "Ana" });
    expect(subject).toBe("Bienvenido/a a Colegio Demo - SAT Escolar");
  });

  it("works without a school (platform emails)", async () => {
    const { subject } = await renderSchoolEmail(fakeClient({}), null, "welcome-family", {});
    expect(subject).toBe("Bienvenido/a a SAT Escolar - SAT Escolar");
  });
});
