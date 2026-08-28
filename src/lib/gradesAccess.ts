/**
 * Why a representative can (or cannot) see the grades of one of their students.
 *
 * The values mirror `public.representative_grades_gate()` (see the
 * `20260828120000_representative_grades_access.sql` migration). The gate is enforced in RLS; this
 * module only turns its answer into something we can show on screen.
 */

export type GradesGateReason =
  | "ok"
  | "not_child"
  | "blocked_by_school"
  | "delinquent"
  | "hidden_by_school";

export interface GradesGateMessage {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  /** `destructive` paints the alert red; the rest use the default (informative) variant. */
  variant: "default" | "destructive";
}

const MESSAGES: Record<Exclude<GradesGateReason, "ok">, GradesGateMessage> = {
  not_child: {
    title: "Estudiante no disponible",
    description:
      "Este estudiante no pertenece a su familia o ya no está inscrito en el plantel. " +
      "Si cree que es un error, comuníquese con el colegio.",
    variant: "destructive",
  },
  blocked_by_school: {
    title: "Acceso bloqueado por el colegio",
    description:
      "El colegio bloqueó temporalmente la consulta de notas y boletas de este estudiante. " +
      "Comuníquese con la institución para más información.",
    variant: "destructive",
  },
  delinquent: {
    title: "Tiene cuotas vencidas",
    description:
      "Para ver las notas y descargar la boleta debe estar al día con los pagos. " +
      "Revise sus cuotas pendientes y reporte su pago desde la sección de Pagos.",
    actionLabel: "Ver mis cuotas",
    actionHref: "/representative/pagos",
    variant: "destructive",
  },
  hidden_by_school: {
    title: "Notas aún no publicadas",
    description:
      "El colegio todavía no ha publicado las notas de este momento. " +
      "Vuelva a intentarlo más adelante o consulte otro momento del año escolar.",
    variant: "default",
  },
};

export function isGradesGateReason(value: unknown): value is GradesGateReason {
  return (
    value === "ok" ||
    value === "not_child" ||
    value === "blocked_by_school" ||
    value === "delinquent" ||
    value === "hidden_by_school"
  );
}

/** `null` when access is granted and there is nothing to show. */
export function gateMessage(reason: GradesGateReason): GradesGateMessage | null {
  if (reason === "ok") return null;
  return MESSAGES[reason];
}
