import { useMemo, useRef } from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type CertificateGradeRow,
  type CertificateInstitution,
  type CertificateYearRecord,
  DEFAULT_EVALUATION_TYPE,
  applyToYearRows,
  createDefaultGradeRows,
  createGradeRow,
  isGradeOutOfRange,
  padTwoDigits,
} from "@/lib/grade-certificate";
import { gradeInWords } from "@/lib/grade-in-words";
import { PLANILLA_EMPTY } from "@/lib/resumen-final-text";
import { BulkApplyPopover } from "./BulkApplyPopover";
import { CERTIFICATE_CELL_INPUT, CertificateTextInput } from "./CertificateTextInput";
import { InstitutionSelect } from "./InstitutionSelect";

interface YearGradesTableProps {
  year: CertificateYearRecord;
  institutions: CertificateInstitution[];
  onChange: (grades: CertificateGradeRow[]) => void;
}

const digitsOnly = (value: string) => value.replace(/\D/g, "");
const CENTERED_CELL = cn(CERTIFICATE_CELL_INPUT, "text-center tabular-nums placeholder:text-muted-foreground/60");

/**
 * Áreas de formación of one year. A year without grades shows the default áreas with `**`; they
 * become real rows as soon as one is edited.
 */
export function YearGradesTable({ year, institutions, onChange }: YearGradesTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);
  const defaultRows = useMemo(() => createDefaultGradeRows(), []);
  const isDefault = year.grades.length === 0;
  const rows = isDefault ? defaultRows : year.grades;

  const patchRow = (id: string, changes: Partial<CertificateGradeRow>) =>
    onChange(rows.map((row) => {
      if (row.id !== id) return row;
      const next = { ...row, ...changes };
      // Typing a grade fills the T-E with its default; the school can still change it.
      if (changes.grade && !row.evaluationType) next.evaluationType = DEFAULT_EVALUATION_TYPE;
      return next;
    }));

  const focusCell = (column: "subject" | "grade", index: number) =>
    tableRef.current?.querySelector<HTMLInputElement>(`[data-cell="${column}-${index}"]`)?.focus();

  const addRow = () => {
    const last = rows[rows.length - 1];
    // A new área starts with the date and institution of the previous one.
    onChange([...rows, createGradeRow({
      evaluationType: last?.evaluationType || DEFAULT_EVALUATION_TYPE,
      month: last?.month ?? "",
      year: last?.year ?? "",
      institutionId: last?.institutionId ?? null,
    })]);
    requestAnimationFrame(() => focusCell("subject", rows.length));
  };

  const onEnter = (column: "subject" | "grade", index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (index === rows.length - 1 && column === "grade") addRow();
    else focusCell(column, index + 1);
  };

  return (
    <div className="space-y-3">
      {isDefault && (
        <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Este año no tiene notas. En la planilla saldrán estas áreas con <span className="font-mono">{PLANILLA_EMPTY.nota}</span>.
            Escribe en cualquiera para empezar, o usa <strong>Sincronizar notas</strong> si lo cursó aquí.
          </p>
        </div>
      )}

      <div className="rounded-lg border overflow-x-auto">
        <table ref={tableRef} className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium min-w-[14rem]">Área de formación</th>
              <th className="px-1 py-2 font-medium w-16">Nota</th>
              <th className="px-2 py-2 text-left font-medium w-32">En letras</th>
              <th className="px-1 py-2 font-medium w-14" title="Tipo de evaluación">T-E</th>
              <th className="px-1 py-2 font-medium w-14">Mes</th>
              <th className="px-1 py-2 font-medium w-20">Año</th>
              <th className="px-1 py-2 font-medium w-24">Institución</th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row, index) => {
              const outOfRange = isGradeOutOfRange(row.grade);
              return (
                <tr key={row.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-1 py-1">
                    <CertificateTextInput
                      data-cell={`subject-${index}`}
                      value={row.subjectName}
                      onValueChange={(subjectName) => patchRow(row.id, { subjectName })}
                      onKeyDown={onEnter("subject", index)}
                      placeholder="Nombre del área"
                      aria-label={`Área de formación ${index + 1}`}
                      className={CERTIFICATE_CELL_INPUT}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CertificateTextInput
                      data-cell={`grade-${index}`}
                      value={row.grade}
                      onValueChange={(grade) => patchRow(row.id, { grade })}
                      onKeyDown={onEnter("grade", index)}
                      normalize={(v) => padTwoDigits(v).toUpperCase()}
                      maxLength={2}
                      inputMode="numeric"
                      placeholder={PLANILLA_EMPTY.nota}
                      aria-label={`Nota de ${row.subjectName || `área ${index + 1}`}`}
                      aria-invalid={outOfRange}
                      title={outOfRange ? "La nota va de 01 a 20" : undefined}
                      className={cn(CENTERED_CELL, "font-semibold", outOfRange && "text-destructive ring-1 ring-destructive")}
                    />
                  </td>
                  <td className="px-2 py-1 text-xs text-muted-foreground">
                    {gradeInWords(row.grade) || <span className="text-muted-foreground/60">{PLANILLA_EMPTY.nota}</span>}
                  </td>
                  <td className="px-1 py-1">
                    <CertificateTextInput
                      value={row.evaluationType}
                      onValueChange={(evaluationType) => patchRow(row.id, { evaluationType })}
                      maxLength={2}
                      placeholder={PLANILLA_EMPTY.nota}
                      aria-label="Tipo de evaluación"
                      className={CENTERED_CELL}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CertificateTextInput
                      value={row.month}
                      onValueChange={(month) => patchRow(row.id, { month: digitsOnly(month) })}
                      normalize={padTwoDigits}
                      maxLength={2}
                      inputMode="numeric"
                      placeholder={PLANILLA_EMPTY.mes}
                      aria-label="Mes"
                      className={CENTERED_CELL}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <CertificateTextInput
                      value={row.year}
                      onValueChange={(value) => patchRow(row.id, { year: digitsOnly(value) })}
                      maxLength={4}
                      inputMode="numeric"
                      placeholder={PLANILLA_EMPTY.anio}
                      aria-label="Año"
                      className={CENTERED_CELL}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <InstitutionSelect
                      institutions={institutions}
                      value={row.institutionId}
                      onChange={(institutionId) => patchRow(row.id, { institutionId })}
                      aria-label="Institución"
                      className="border-0 shadow-none bg-transparent focus:ring-1 focus:ring-offset-0"
                    />
                  </td>
                  <td className="pr-1 py-1 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      title="Quitar área"
                      onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Agregar área
        </Button>
        <BulkApplyPopover
          rowCount={rows.length}
          institutions={institutions}
          onApply={(patch) => onChange(applyToYearRows(rows, patch))}
        />
      </div>
    </div>
  );
}
