// Shared HTML builders for payroll emails (individual receipt + monthly report).
// Kept framework-free so both Edge Functions reuse the same markup and money format.

export type Currency = "VES" | "USD";

export interface ReceiptLine {
  description: string;
  amount: number;
}

export interface ReceiptEmailData {
  schoolName: string;
  beneficiaryName: string;
  documentId: string;
  categoryLabel: string;
  periodName: string;
  currency: Currency;
  exchangeRate: number;
  earnings: ReceiptLine[];
  deductions: ReceiptLine[];
  gross: number;
  deductionsTotal: number;
  net: number;
  netVes: number;
  methodLabel: string;
  paymentDate: string;
  notes: string;
}

export interface ReportBucket {
  label: string;
  amount: number;
}

export interface MonthlyReportData {
  schoolName: string;
  monthLabel: string;
  paymentsCount: number;
  totalVes: number;
  byCategory: ReportBucket[];
  byMethod: ReportBucket[];
}

export function money(amount: number, currency: Currency = "VES"): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${value.toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function rows(lines: ReceiptLine[], currency: Currency): string {
  if (lines.length === 0) return `<tr><td colspan="2" style="padding:6px 8px;color:#888">—</td></tr>`;
  return lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(l.description)}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${money(l.amount, currency)}</td></tr>`
    )
    .join("");
}

export function buildReceiptHtml(d: ReceiptEmailData): string {
  const usdBlock =
    d.currency !== "VES"
      ? `<tr><td style="padding:6px 8px">Tasa aplicada</td><td style="padding:6px 8px;text-align:right">${d.exchangeRate.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES/USD</td></tr>
         <tr><td style="padding:6px 8px;font-weight:bold">Equivalente en VES</td><td style="padding:6px 8px;text-align:right;font-weight:bold">${money(d.netVes, "VES")}</td></tr>`
      : "";
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#222">
    <div style="background:#2563eb;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">${escapeHtml(d.schoolName)}</h2>
      <p style="margin:4px 0 0;font-size:14px;opacity:.9">Recibo de Pago de Nómina</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
      <p style="margin:0 0 4px"><strong>Beneficiario:</strong> ${escapeHtml(d.beneficiaryName)}</p>
      <p style="margin:0 0 4px"><strong>Cédula:</strong> ${escapeHtml(d.documentId)}</p>
      <p style="margin:0 0 4px"><strong>Categoría:</strong> ${escapeHtml(d.categoryLabel)}</p>
      <p style="margin:0 0 4px"><strong>Período:</strong> ${escapeHtml(d.periodName)}</p>
      <p style="margin:0 0 4px"><strong>Método de pago:</strong> ${escapeHtml(d.methodLabel)}</p>
      <p style="margin:0 0 12px"><strong>Fecha de pago:</strong> ${escapeHtml(d.paymentDate)}</p>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px">
        <thead><tr><th style="text-align:left;padding:6px 8px;background:#f3f4f6">Asignaciones</th><th style="text-align:right;padding:6px 8px;background:#f3f4f6">Monto</th></tr></thead>
        <tbody>${rows(d.earnings, d.currency)}</tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px">
        <thead><tr><th style="text-align:left;padding:6px 8px;background:#f3f4f6">Deducciones</th><th style="text-align:right;padding:6px 8px;background:#f3f4f6">Monto</th></tr></thead>
        <tbody>${rows(d.deductions, d.currency)}</tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;font-size:14px;background:#f9fafb;border-radius:6px">
        <tr><td style="padding:6px 8px">Total asignaciones</td><td style="padding:6px 8px;text-align:right">${money(d.gross, d.currency)}</td></tr>
        <tr><td style="padding:6px 8px">Total deducciones</td><td style="padding:6px 8px;text-align:right">${money(d.deductionsTotal, d.currency)}</td></tr>
        <tr><td style="padding:6px 8px;font-weight:bold">Neto a pagar</td><td style="padding:6px 8px;text-align:right;font-weight:bold">${money(d.net, d.currency)}</td></tr>
        ${usdBlock}
      </table>
      ${d.notes ? `<p style="margin:12px 0 0;font-size:13px;color:#555"><strong>Observaciones:</strong> ${escapeHtml(d.notes)}</p>` : ""}
      <p style="margin:16px 0 0;font-size:12px;color:#888">Este es un comprobante generado automáticamente por SAT Escolar.</p>
    </div>
  </div>`;
}

/** Simple inline SVG bar chart (email-safe: no external assets, no scripts). */
function barChart(buckets: ReportBucket[]): string {
  const data = buckets.filter((b) => b.amount > 0);
  if (data.length === 0) return `<p style="color:#888;font-size:13px">Sin pagos en el período.</p>`;
  const max = Math.max(...data.map((b) => b.amount));
  const barW = 380;
  const rowsSvg = data
    .map((b, i) => {
      const w = max > 0 ? Math.round((b.amount / max) * barW) : 0;
      const y = i * 34;
      return `
      <text x="0" y="${y + 14}" font-size="12" fill="#374151">${escapeHtml(b.label)}</text>
      <rect x="0" y="${y + 18}" width="${w}" height="12" rx="3" fill="#2563eb"></rect>
      <text x="${w + 6}" y="${y + 28}" font-size="11" fill="#6b7280">${money(b.amount, "VES")}</text>`;
    })
    .join("");
  return `<svg width="100%" viewBox="0 0 ${barW + 140} ${data.length * 34}" xmlns="http://www.w3.org/2000/svg">${rowsSvg}</svg>`;
}

function bucketTable(buckets: ReportBucket[]): string {
  const data = buckets.filter((b) => b.amount > 0);
  if (data.length === 0) return `<tr><td colspan="2" style="padding:6px 8px;color:#888">—</td></tr>`;
  return data
    .map(
      (b) =>
        `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${escapeHtml(b.label)}</td>` +
        `<td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${money(b.amount, "VES")}</td></tr>`
    )
    .join("");
}

export function buildMonthlyReportHtml(d: MonthlyReportData): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#222">
    <div style="background:#2563eb;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">${escapeHtml(d.schoolName)}</h2>
      <p style="margin:4px 0 0;font-size:14px;opacity:.9">Reporte de Nómina — ${escapeHtml(d.monthLabel)}</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px">
      <div style="display:flex;gap:12px;margin-bottom:16px">
        <div style="flex:1;background:#f9fafb;border-radius:6px;padding:12px">
          <p style="margin:0;font-size:12px;color:#6b7280">Total pagado (VES)</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:bold">${money(d.totalVes, "VES")}</p>
        </div>
        <div style="flex:1;background:#f9fafb;border-radius:6px;padding:12px">
          <p style="margin:0;font-size:12px;color:#6b7280">Pagos realizados</p>
          <p style="margin:4px 0 0;font-size:20px;font-weight:bold">${d.paymentsCount}</p>
        </div>
      </div>

      <h3 style="font-size:14px;margin:0 0 8px">Total por categoría</h3>
      ${barChart(d.byCategory)}

      <h3 style="font-size:14px;margin:16px 0 8px">Total por método de pago</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tbody>${bucketTable(d.byMethod)}</tbody>
      </table>

      <p style="margin:16px 0 0;font-size:12px;color:#888">Reporte generado automáticamente por SAT Escolar.</p>
    </div>
  </div>`;
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
