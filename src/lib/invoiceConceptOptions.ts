/**
 * Concept fields offered by the invoice template editor (/formatos).
 *
 * Concepts are per school year, and each yearly copy shares the `lineage_id` of the original.
 * Invoice fields are keyed by lineage (`concept:{lineage_id}`), so one template field prints the
 * same concept in every year. For the original concepts `lineage_id = id`, which keeps the keys of
 * templates designed before concepts were split by year.
 */

export interface ConceptLineageRow {
  lineage_id: string;
  name: string;
}

export interface InvoiceConceptOption {
  /** Lineage id — the part after `concept:` in the template field key. */
  id: string;
  name: string;
}

/**
 * One option per lineage, sorted by name. Rows must come newest first: the first name seen for a
 * lineage wins, so a concept renamed in a later year shows its current name.
 */
export function uniqueConceptLineages(rows: ConceptLineageRow[]): InvoiceConceptOption[] {
  const byLineage = new Map<string, string>();
  rows.forEach((row) => {
    if (row.lineage_id && !byLineage.has(row.lineage_id)) byLineage.set(row.lineage_id, row.name);
  });
  return [...byLineage.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
