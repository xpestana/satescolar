/** Replace {{key}} placeholders in HTML with provided values */
export function resolveSnippets(
  bodyHtml: string,
  data: Record<string, string>
): string {
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

/** Wraps a custom body_html in the standard email layout with school branding */
export function wrapWithEmailLayout(
  bodyHtml: string,
  primaryColor: string,
  textColor: string,
  schoolName: string,
  schoolLogoUrl: string | null
): string {
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
  <tr><td style="padding:32px 32px 24px;">
    ${bodyHtml}
  </td></tr>
  <tr><td align="center" style="padding:20px 24px;background-color:#f8f9fc;border-top:1px solid #e8e8ed;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#6b7280;">SAT ESCOLAR</p>
    <a href="https://satescolar.com" target="_blank" style="font-size:13px;color:#1e78c8;text-decoration:none;">satescolar.com</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function buildWelcomeEmailHtml(
  schoolName: string,
  schoolLogoUrl: string | null,
  userEmail: string,
  password: string,
  role: "representante" | "docente",
  platformUrl: string
): string {
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
  <tr><td align="center" style="padding:32px 24px 16px;background-color:#f8f9fc;border-bottom:1px solid #e8e8ed;">
    ${logoBlock}
    <h2 style="margin:0;font-size:20px;color:#1a1a2e;">${schoolName}</h2>
  </td></tr>
  <tr><td style="padding:32px 32px 24px;">
    <h1 style="margin:0 0 16px;font-size:24px;color:#1a1a2e;">¡Bienvenido/a!</h1>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#4a4a5a;">
      Ha sido registrado como <strong>${role}</strong> en <strong>${schoolName}</strong> a través de la plataforma <strong>SAT Escolar</strong>.
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#4a4a5a;">Sus credenciales de acceso:</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4ff;border-radius:8px;margin:12px 0 24px;">
      <tr><td style="padding:16px 20px;">
        <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">Usuario</p>
        <p style="margin:0 0 12px;font-size:16px;font-weight:bold;color:#1a1a2e;">${userEmail}</p>
        <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">Contraseña</p>
        <p style="margin:0;font-size:16px;font-weight:bold;color:#1a1a2e;">${password}</p>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:8px 0 16px;">
        <a href="${platformUrl}" target="_blank" style="display:inline-block;padding:14px 32px;background-color:#1e78c8;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:8px;">Ingresar a la Plataforma</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Le recomendamos cambiar su contraseña una vez ingrese al sistema.</p>
  </td></tr>
  <tr><td align="center" style="padding:20px 24px;background-color:#f8f9fc;border-top:1px solid #e8e8ed;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#6b7280;">SAT ESCOLAR</p>
    <a href="https://satescolar.com" target="_blank" style="font-size:13px;color:#1e78c8;text-decoration:none;">satescolar.com</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export interface DelinquencyConcept {
  name: string;
  balance: number;
}

export function buildDelinquencyEmailHtml(
  schoolName: string,
  studentName: string,
  gradeName: string,
  sectionName: string,
  concepts: DelinquencyConcept[],
  totalOwed: number,
  schoolPhone?: string | null,
  schoolEmail?: string | null
): string {
  const conceptsList = concepts
    .map(
      (c) =>
        `<li>${c.name}: <strong>${c.balance.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</strong></li>`
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Recordatorio de Pago Pendiente</h2>
      <p>Estimado(a) representante,</p>
      <p>Le informamos cordialmente que el/la estudiante <strong>${studentName}</strong>${gradeName ? ` (${gradeName} - ${sectionName})` : ""} presenta un saldo pendiente en nuestra institución.</p>
      <h3 style="color: #555;">Conceptos pendientes:</h3>
      <ul>${conceptsList}</ul>
      <p style="font-size: 18px; color: #c0392b;"><strong>Total pendiente: ${totalOwed.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES</strong></p>
      <p>Le invitamos amablemente a regularizar su situación a la brevedad posible. Si ya realizó el pago, le agradecemos nos haga llegar el comprobante correspondiente.</p>
      <p>Para cualquier consulta, puede comunicarse con nosotros:</p>
      <ul>
        ${schoolPhone ? `<li>Teléfono: ${schoolPhone}</li>` : ""}
        ${schoolEmail ? `<li>Email: ${schoolEmail}</li>` : ""}
      </ul>
      <p>Atentamente,<br/><strong>${schoolName}</strong></p>
      <hr style="border: none; border-top: 1px solid #eee; margin-top: 30px;"/>
      <p style="font-size: 11px; color: #999;">Este es un mensaje automático generado por el sistema de gestión escolar.</p>
    </div>
  `;
}
