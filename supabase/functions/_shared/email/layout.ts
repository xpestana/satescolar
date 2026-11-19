/**
 * The one email layout (header with the school's colors and logo, body, SAT Escolar footer).
 * Pure: used by the Edge Functions AND by the template editor's preview, so both look the same.
 */

export interface EmailLayoutOptions {
  primaryColor: string;
  textColor: string;
  schoolName: string;
  logoUrl: string | null;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for HTML content and attribute values. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

/** Only `#rgb` / `#rrggbb` colors reach a style attribute. */
export function safeColor(value: string | null | undefined, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value.trim()) ? value.trim() : fallback;
}

/** Wraps an already-rendered body in the standard layout. */
export function wrapWithEmailLayout(bodyHtml: string, opts: EmailLayoutOptions): string {
  const primary = safeColor(opts.primaryColor, "#1e78c8");
  const text = safeColor(opts.textColor, "#ffffff");
  const schoolName = escapeHtml(opts.schoolName);
  const logoBlock = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="${schoolName}" style="max-height:80px;max-width:200px;margin-bottom:12px;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  .sat-body img { max-width: 100%; height: auto; }
  .sat-body table { max-width: 100%; }
  @media only screen and (max-width: 600px) {
    .sat-outer { padding: 12px 8px !important; }
    .sat-header { padding: 18px 16px 12px !important; }
    .sat-body { padding: 20px 18px 16px !important; font-size: 15px !important; }
    .sat-footer { padding: 16px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="sat-outer" style="background-color:#f4f4f7;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
  <tr><td align="center" class="sat-header" style="padding:24px 24px 16px;background-color:${primary};border-bottom:3px solid ${primary};">
    ${logoBlock}
    <h2 style="margin:0;font-size:20px;color:${text};word-break:break-word;">${schoolName}</h2>
  </td></tr>
  <tr><td class="sat-body" style="padding:32px 32px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#4a4a5a;line-height:1.6;word-break:break-word;">
    ${bodyHtml}
  </td></tr>
  <tr><td align="center" class="sat-footer" style="padding:20px 24px;background-color:#f8f9fc;border-top:1px solid #e8e8ed;">
    <p style="margin:0 0 4px;font-size:13px;font-weight:bold;color:#6b7280;">SAT ESCOLAR</p>
    <a href="https://satescolar.com" target="_blank" style="font-size:13px;color:#1e78c8;text-decoration:none;">satescolar.com</a>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
