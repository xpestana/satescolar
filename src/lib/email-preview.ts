/** Datos ficticios por tipo para el preview */
const DUMMY_DATA: Record<string, Record<string, string>> = {
  "welcome-family": {
    nombre_colegio: "Colegio Demo SAT",
    email_usuario: "maria.perez@demo.com",
    contrasena: "Demo1234",
    url_plataforma: "https://app.satescolar.com/login",
  },
  "welcome-teacher": {
    nombre_colegio: "Colegio Demo SAT",
    email_usuario: "pedro.gomez@demo.com",
    contrasena: "12345678",
    url_plataforma: "https://app.satescolar.com/login",
  },
  delinquency: {
    nombre_colegio: "Colegio Demo SAT",
    nombre_estudiante: "Carlos Rodríguez",
    grado_seccion: "5to Grado - Sección A",
    conceptos_pendientes:
      "<ul><li>Mensualidad Enero 2025: <strong>150,00 VES</strong></li><li>Mensualidad Febrero 2025: <strong>150,00 VES</strong></li><li>Inscripción Anual: <strong>200,00 VES</strong></li></ul>",
    total_adeudado: "500,00 VES",
    telefono_colegio: "0412-0000000",
    email_colegio: "contacto@colegiodemo.edu.ve",
  },
  "payment-reminder": {
    nombre_colegio: "Colegio Demo SAT",
    nombre_estudiante: "Carlos Rodríguez",
    grado_seccion: "5to Grado - Sección A",
    conceptos_pendientes:
      "<ul><li>Mensualidad Marzo 2025: <strong>150,00 VES</strong></li></ul>",
    total_adeudado: "150,00 VES",
    telefono_colegio: "0412-0000000",
    email_colegio: "contacto@colegiodemo.edu.ve",
  },
};

function resolveSnippets(html: string, data: Record<string, string>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

/** Genera el HTML completo del correo para el preview en iframe */
export function buildEmailPreviewHtml(
  templateType: string,
  bodyHtml: string,
  primaryColor: string,
  textColor: string,
  schoolName: string,
  schoolLogoUrl: string | null
): string {
  const dummy = DUMMY_DATA[templateType] ?? {};
  // primary_color is available as a snippet so buttons in body_html pick it up
  const resolvedBody = resolveSnippets(bodyHtml, { ...dummy, primary_color: primaryColor });

  const logoBlock = schoolLogoUrl
    ? `<img src="${schoolLogoUrl}" alt="${schoolName}" style="max-height:80px;max-width:200px;margin-bottom:12px;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:32px 0;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td align="center" style="padding:24px 24px 16px;background-color:${primaryColor};border-bottom:3px solid ${primaryColor};">
    ${logoBlock}
    <h2 style="margin:0;font-size:20px;color:${textColor};">${schoolName}</h2>
  </td></tr>
  <tr><td style="padding:32px 32px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#4a4a5a;line-height:1.6;">
    ${resolvedBody}
  </td></tr>
  <tr><td align="center" style="padding:20px 24px;background-color:#f8f9fc;border-top:1px solid #e8e8ed;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#6b7280;">SAT ESCOLAR</p>
    <a href="https://satescolar.com" style="font-size:13px;color:#1e78c8;text-decoration:none;">satescolar.com</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
