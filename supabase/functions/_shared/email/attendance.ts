import { escapeHtml, wrapWithEmailLayout } from "./layout.ts";

export interface AttendanceEmailInput {
  schoolName: string;
  logoUrl: string | null;
  personName: string;
  roleLabel: string;
  dateLabel: string;
  timeLabel: string;
}

/** "Attendance recorded" notice sent after a QR scan (fixed text, standard layout). */
export function buildAttendanceEmail(input: AttendanceEmailInput): { subject: string; html: string } {
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:8px 0;color:#666;">${label}:</td><td style="padding:8px 0;${bold ? "font-weight:bold;" : ""}">${escapeHtml(value)}</td></tr>`;
  const body = `<h3 style="color:#01051e;margin-top:0;">✅ Asistencia Registrada</h3>
<table style="width:100%;border-collapse:collapse;">
${row("Nombre", input.personName, true)}
${row("Rol", input.roleLabel)}
${row("Fecha", input.dateLabel)}
${row("Hora", input.timeLabel)}
</table>`;
  return {
    subject: `Asistencia registrada - ${input.personName}`,
    html: wrapWithEmailLayout(body, {
      primaryColor: "#01051e",
      textColor: "#ffffff",
      schoolName: input.schoolName,
      logoUrl: input.logoUrl,
    }),
  };
}
