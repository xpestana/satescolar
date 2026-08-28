/**
 * Picking the boleta template that applies to a student.
 *
 * The school can keep several active templates at once (`is_active` is not exclusive), so the
 * winner is resolved on the client with the rules documented in `docs/desc/09-notas-y-boletas.md`:
 *
 *   1. the first candidate whose `applicable_grades` contains the student grade;
 *   2. otherwise the first candidate without `applicable_grades` (wildcard);
 *   3. otherwise `null`, and the caller falls back to `DEFAULT_BACHILLERATO_CONFIG`.
 *
 * This used to be copy-pasted in five places (`bachilleratoBoleta.ts` x4 and
 * `primaryDescriptiveBoleta.ts`); the representative module would have been the sixth.
 */

export interface BoletaTemplateCandidate {
  applicable_grades?: string[] | null;
  [key: string]: unknown;
}

export function pickBoletaTemplate<T extends BoletaTemplateCandidate>(
  templates: T[] | null | undefined,
  gradeKey: string,
): T | null {
  const candidates = templates ?? [];
  return (
    candidates.find(
      (t) => Array.isArray(t.applicable_grades) && t.applicable_grades.includes(gradeKey),
    ) ??
    candidates.find((t) => !t.applicable_grades || t.applicable_grades.length === 0) ??
    null
  );
}
